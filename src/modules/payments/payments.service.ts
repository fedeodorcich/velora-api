import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { paginatedResult, type PaginatedResult } from '../../core/dto/paginated-result.js';
import { Project } from '../projects/entities/project.entity.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentDto } from './dto/update-payment.dto.js';
import { Payment, PaymentStatus } from './entities/payment.entity.js';
import type { PaymentListStatus } from './dto/payment-list-query.dto.js';

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Toda operación filtra por `userId` para garantizar el aislamiento multi-usuario.
 * Un cobro siempre cuelga de un proyecto del usuario y hereda su moneda.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  findAll(userId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { userId },
      relations: { project: { client: true } },
      order: { dueDate: 'ASC', number: 'ASC' },
    });
  }

  async findPage(
    userId: string,
    page: number,
    limit: number,
    status?: PaymentListStatus,
  ): Promise<PaginatedResult<Payment>> {
    const today = todayIso();
    const where = !status
      ? { userId }
      : status === 'vencido'
        ? { userId, status: PaymentStatus.Pendiente, dueDate: LessThan(today) }
        : status === 'pendiente'
          ? { userId, status: PaymentStatus.Pendiente, dueDate: MoreThanOrEqual(today) }
          : { userId, status: PaymentStatus.Pagado };

    const [items, total] = await this.paymentsRepository.findAndCount({
      where,
      relations: { project: { client: true } },
      order: { dueDate: 'ASC', number: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginatedResult(items, total, page, limit);
  }

  async findOne(userId: string, id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id, userId },
      relations: { project: { client: true } },
    });
    if (!payment) {
      throw new NotFoundException('Cobro no encontrado.');
    }
    return payment;
  }

  async create(userId: string, dto: CreatePaymentDto): Promise<Payment> {
    const project = await this.loadProject(userId, dto.projectId);

    const payment = this.paymentsRepository.create({
      userId,
      projectId: project.id,
      number: await this.nextNumber(userId),
      concept: dto.concept.trim(),
      amount: dto.amount,
      currency: project.currency.toUpperCase(),
      dueDate: dto.dueDate,
      status: PaymentStatus.Pendiente,
      paidAt: null,
      method: dto.method?.trim() || null,
      notes: dto.notes?.trim() || null,
    });

    return this.paymentsRepository.save(payment);
  }

  async update(userId: string, id: string, dto: UpdatePaymentDto): Promise<Payment> {
    const payment = await this.findOne(userId, id);

    if (dto.concept !== undefined) {
      payment.concept = dto.concept.trim();
    }
    if (dto.amount !== undefined) {
      payment.amount = dto.amount;
    }
    if (dto.dueDate !== undefined) {
      payment.dueDate = dto.dueDate;
    }
    if (dto.method !== undefined) {
      payment.method = dto.method.trim() || null;
    }
    if (dto.notes !== undefined) {
      payment.notes = dto.notes.trim() || null;
    }

    return this.paymentsRepository.save(payment);
  }

  /** Marca pagado (setea `paidAt`) o pendiente (lo limpia). */
  async updateStatus(userId: string, id: string, status: PaymentStatus): Promise<Payment> {
    const payment = await this.findOne(userId, id);
    payment.status = status;
    payment.paidAt = status === PaymentStatus.Pagado ? new Date() : null;
    return this.paymentsRepository.save(payment);
  }

  async remove(userId: string, id: string): Promise<void> {
    const payment = await this.findOne(userId, id);
    await this.paymentsRepository.remove(payment);
  }

  /** El proyecto debe existir y pertenecer al usuario (si no → `404`). */
  private async loadProject(userId: string, projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
    return project;
  }

  /** Correlativo por usuario; el índice único `(user_id, number)` evita duplicados. */
  private async nextNumber(userId: string): Promise<number> {
    const last = await this.paymentsRepository.findOne({
      where: { userId },
      order: { number: 'DESC' },
      select: { number: true },
    });
    return (last?.number ?? 0) + 1;
  }
}
