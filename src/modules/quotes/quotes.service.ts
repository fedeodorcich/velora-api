import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientsService } from '../clients/clients.service.js';
import { Project } from '../projects/entities/project.entity.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { QuoteItemDto } from './dto/quote-item.dto.js';
import { UpdateQuoteDto } from './dto/update-quote.dto.js';
import { QuoteItem } from './entities/quote-item.entity.js';
import { Quote, QuoteStatus } from './entities/quote.entity.js';

/** Presupuesto con sus líneas de detalle ya cargadas. */
export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

type QuoteTotals = Pick<Quote, 'subtotal' | 'taxAmount' | 'total'>;

/**
 * Toda operación filtra por `userId` para garantizar el aislamiento multi-usuario.
 * Las líneas se cargan y persisten de forma explícita (no hay lado inverso `Quote.items`).
 */
@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly quotesRepository: Repository<Quote>,
    @InjectRepository(QuoteItem)
    private readonly itemsRepository: Repository<QuoteItem>,
    private readonly clientsService: ClientsService,
  ) {}

  findAll(userId: string): Promise<Quote[]> {
    return this.quotesRepository.find({
      where: { userId },
      relations: { client: true },
      order: { number: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<QuoteWithItems> {
    const quote = await this.quotesRepository.findOne({
      where: { id, userId },
      relations: { client: true },
    });
    if (!quote) {
      throw new NotFoundException('Presupuesto no encontrado.');
    }
    return { ...quote, items: await this.loadItems(quote.id) };
  }

  async create(userId: string, dto: CreateQuoteDto): Promise<QuoteWithItems> {
    const client = await this.clientsService.findOne(userId, dto.clientId);

    const items = dto.items.map((item, index) => this.buildItem(item, index));
    const taxRate = dto.taxRate ?? 0;

    const quote = this.quotesRepository.create({
      userId,
      clientId: client.id,
      number: await this.nextNumber(userId),
      title: dto.title.trim(),
      status: dto.status ?? QuoteStatus.Borrador,
      currency: (dto.currency ?? client.currency).toUpperCase(),
      issueDate: dto.issueDate ?? this.today(),
      validUntil: dto.validUntil ?? null,
      taxRate,
      notes: dto.notes ?? null,
      ...this.computeTotals(items, taxRate),
    });

    const saved = await this.quotesRepository.save(quote);
    const savedItems = await this.itemsRepository.save(
      items.map((item) => this.itemsRepository.create({ ...item, quoteId: saved.id })),
    );

    return { ...saved, items: savedItems };
  }

  async update(userId: string, id: string, dto: UpdateQuoteDto): Promise<QuoteWithItems> {
    const quote = await this.findOne(userId, id);

    if (dto.clientId !== undefined && dto.clientId !== quote.clientId) {
      const client = await this.clientsService.findOne(userId, dto.clientId);
      quote.clientId = client.id;
    }
    if (dto.title !== undefined) {
      quote.title = dto.title.trim();
    }
    if (dto.status !== undefined) {
      if (dto.status !== quote.status && (await this.hasProject(quote.id, userId))) {
        throw this.projectLockedException();
      }
      quote.status = dto.status;
    }
    if (dto.currency !== undefined) {
      quote.currency = dto.currency.toUpperCase();
    }
    if (dto.issueDate !== undefined) {
      quote.issueDate = dto.issueDate;
    }
    if (dto.validUntil !== undefined) {
      quote.validUntil = dto.validUntil;
    }
    if (dto.taxRate !== undefined) {
      quote.taxRate = dto.taxRate;
    }
    if (dto.notes !== undefined) {
      quote.notes = dto.notes;
    }

    let items: QuoteItem[] = quote.items;
    if (dto.items !== undefined) {
      const inputs = dto.items.map((item, index) => this.buildItem(item, index));
      await this.itemsRepository.delete({ quoteId: quote.id });
      items = await this.itemsRepository.save(
        inputs.map((item) => this.itemsRepository.create({ ...item, quoteId: quote.id })),
      );
    }

    Object.assign(quote, this.computeTotals(items, quote.taxRate));
    const saved = await this.quotesRepository.save(quote);

    return { ...saved, items };
  }

  async updateStatus(userId: string, id: string, status: QuoteStatus): Promise<QuoteWithItems> {
    const quote = await this.findOne(userId, id);

    if (await this.hasProject(id, userId)) {
      throw this.projectLockedException();
    }

    if (status !== QuoteStatus.Borrador && quote.items.length === 0) {
      throw new BadRequestException(
        'Un presupuesto necesita al menos una línea antes de salir de borrador.',
      );
    }

    quote.status = status;
    const saved = await this.quotesRepository.save(quote);

    return { ...saved, items: quote.items };
  }

  async remove(userId: string, id: string): Promise<void> {
    const quote = await this.findOne(userId, id);

    // Un presupuesto con proyecto de origen no se puede borrar (el proyecto vive).
    if (await this.hasProject(id, userId)) {
      throw new ConflictException({
        message:
          'No puedes eliminar un presupuesto que ya tiene un proyecto asociado. Elimina primero el proyecto.',
        reason: 'project',
      });
    }

    // Las líneas se eliminan en cascada a nivel base de datos.
    await this.quotesRepository.remove(quote);
  }

  /** Indica si el presupuesto ya tiene un proyecto (bloquea estado y borrado). */
  private async hasProject(quoteId: string, userId: string): Promise<boolean> {
    const count = await this.quotesRepository.manager.count(Project, {
      where: { quoteId, userId },
    });
    return count > 0;
  }

  private projectLockedException(): ConflictException {
    return new ConflictException({
      message: 'No puedes cambiar el estado de un presupuesto que ya tiene un proyecto asociado.',
      reason: 'project',
    });
  }

  private loadItems(quoteId: string): Promise<QuoteItem[]> {
    return this.itemsRepository.find({ where: { quoteId }, order: { position: 'ASC' } });
  }

  private buildItem(dto: QuoteItemDto, position: number): Omit<QuoteItem, 'id' | 'quoteId' | 'quote'> {
    return {
      description: dto.description.trim(),
      quantity: this.round2(dto.quantity),
      unitPrice: this.round2(dto.unitPrice),
      position,
    };
  }

  private computeTotals(
    items: ReadonlyArray<Pick<QuoteItem, 'quantity' | 'unitPrice'>>,
    taxRate: number,
  ): QuoteTotals {
    const subtotal = this.round2(items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0));
    const taxAmount = this.round2((subtotal * taxRate) / 100);
    return { subtotal, taxAmount, total: this.round2(subtotal + taxAmount) };
  }

  /** Correlativo por usuario; el índice único `(user_id, number)` evita duplicados. */
  private async nextNumber(userId: string): Promise<number> {
    const last = await this.quotesRepository.findOne({
      where: { userId },
      order: { number: 'DESC' },
      select: { number: true },
    });
    return (last?.number ?? 0) + 1;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
