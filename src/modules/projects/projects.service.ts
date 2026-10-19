import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../payments/entities/payment.entity.js';
import { Quote, QuoteStatus } from '../quotes/entities/quote.entity.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { Project, ProjectStatus } from './entities/project.entity.js';

/**
 * Toda operación filtra por `userId` para garantizar el aislamiento multi-usuario.
 * Un proyecto se crea **siempre** a partir de un presupuesto aprobado: el cliente,
 * el nombre, la moneda y el monto se derivan del presupuesto de origen.
 */
@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Quote)
    private readonly quotesRepository: Repository<Quote>,
  ) {}

  findAll(userId: string): Promise<Project[]> {
    return this.projectsRepository.find({
      where: { userId },
      relations: { client: true },
      order: { number: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id, userId },
      relations: { client: true },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
    return project;
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const quote = await this.loadAvailableQuote(userId, dto.quoteId);

    const project = this.projectsRepository.create({
      userId,
      clientId: quote.clientId,
      quoteId: quote.id,
      number: await this.nextNumber(userId),
      name: quote.title,
      status: ProjectStatus.Planificado,
      currency: quote.currency.toUpperCase(),
      budget: quote.total,
      progress: dto.progress ?? 0,
      startDate: dto.startDate ?? null,
      dueDate: dto.dueDate ?? null,
      description: dto.description ?? null,
      notes: dto.notes ?? null,
    });

    return this.projectsRepository.save(project);
  }

  async update(userId: string, id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(userId, id);

    if (dto.name !== undefined) {
      project.name = dto.name.trim();
    }
    if (dto.currency !== undefined) {
      project.currency = dto.currency.toUpperCase();
    }
    if (dto.budget !== undefined) {
      project.budget = dto.budget;
    }
    if (dto.progress !== undefined) {
      project.progress = dto.progress;
    }
    if (dto.startDate !== undefined) {
      project.startDate = dto.startDate;
    }
    if (dto.dueDate !== undefined) {
      project.dueDate = dto.dueDate;
    }
    if (dto.description !== undefined) {
      project.description = dto.description;
    }
    if (dto.notes !== undefined) {
      project.notes = dto.notes;
    }

    return this.projectsRepository.save(project);
  }

  async updateStatus(userId: string, id: string, status: ProjectStatus): Promise<Project> {
    const project = await this.findOne(userId, id);
    project.status = status;
    return this.projectsRepository.save(project);
  }

  /**
   * Borra un proyecto. Si tiene **cobros** asociados, por defecto responde `409`
   * (`reason: 'payments'`); solo con `cascade` se eliminan los cobros y el proyecto
   * en una transacción (RF-09).
   */
  async remove(userId: string, id: string, cascade = false): Promise<void> {
    const project = await this.findOne(userId, id);

    if (await this.hasPayments(userId, id)) {
      if (!cascade) {
        throw new ConflictException({
          message:
            'No puedes eliminar un proyecto con cobros asociados. Elimina primero sus cobros o confirma el borrado en cascada.',
          reason: 'payments',
        });
      }
      await this.removeWithPayments(userId, id);
      return;
    }

    await this.projectsRepository.remove(project);
  }

  /** Indica si el proyecto tiene cobros asociados. */
  private async hasPayments(userId: string, id: string): Promise<boolean> {
    const count = await this.projectsRepository.manager.count(Payment, {
      where: { projectId: id, userId },
    });
    return count > 0;
  }

  /**
   * Borra el proyecto y todos sus cobros en una sola transacción.
   * Los cobros se eliminan primero para satisfacer la FK `ON DELETE RESTRICT`.
   */
  private async removeWithPayments(userId: string, id: string): Promise<void> {
    await this.projectsRepository.manager.transaction(async (manager) => {
      await manager.delete(Payment, { projectId: id, userId });
      await manager.delete(Project, { id, userId });
    });
  }

  /**
   * Valida que el presupuesto exista, pertenezca al usuario, esté **aceptado** y
   * todavía no tenga un proyecto asociado (relación uno a uno).
   */
  private async loadAvailableQuote(userId: string, quoteId: string): Promise<Quote> {
    const quote = await this.quotesRepository.findOne({ where: { id: quoteId, userId } });
    if (!quote) {
      throw new NotFoundException('Presupuesto no encontrado.');
    }

    if (quote.status !== QuoteStatus.Aceptado) {
      throw new ConflictException({
        message: 'Solo puedes crear proyectos a partir de presupuestos aceptados.',
        reason: 'quote-not-approved',
      });
    }

    const linked = await this.projectsRepository.findOne({ where: { quoteId, userId } });
    if (linked) {
      throw new ConflictException({
        message: 'Ya existe un proyecto para este presupuesto.',
        reason: 'quote-taken',
      });
    }

    return quote;
  }

  /** Correlativo por usuario; el índice único `(user_id, number)` evita duplicados. */
  private async nextNumber(userId: string): Promise<number> {
    const last = await this.projectsRepository.findOne({
      where: { userId },
      order: { number: 'DESC' },
      select: { number: true },
    });
    return (last?.number ?? 0) + 1;
  }
}
