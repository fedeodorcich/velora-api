import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { FREE_ACTIVE_CLIENT_LIMIT, hasProAccess } from '../../core/billing/plan.js';
import { paginatedResult, type PaginatedResult } from '../../core/dto/paginated-result.js';
import { Project } from '../projects/entities/project.entity.js';
import { Quote } from '../quotes/entities/quote.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Client, ClientStatus } from './entities/client.entity.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';

/**
 * Toda operación filtra por `userId` para garantizar el aislamiento multi-usuario.
 */
@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  findAll(userId: string): Promise<Client[]> {
    return this.clientsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findPage(userId: string, page: number, limit: number): Promise<PaginatedResult<Client>> {
    const [items, total] = await this.clientsRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginatedResult(items, total, page, limit);
  }

  async findOne(userId: string, id: string): Promise<Client> {
    const client = await this.clientsRepository.findOne({ where: { id, userId } });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado.');
    }
    return client;
  }

  create(userId: string, dto: CreateClientDto): Promise<Client> {
    const client = this.clientsRepository.create({
      userId,
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      phone: dto.phone ?? null,
      company: dto.company ?? null,
      cuilCuit: dto.cuilCuit ?? null,
      currency: dto.currency ? dto.currency.toUpperCase() : 'USD',
      notes: dto.notes ?? null,
      status: dto.status ?? ClientStatus.Lead,
    });
    if (client.status !== ClientStatus.Activo) {
      return this.clientsRepository.save(client);
    }

    return this.clientsRepository.manager.transaction(async (manager) => {
      const user = await this.lockAccount(manager, userId);
      await this.ensureActiveClientSlot(manager, user);
      return manager.save(client);
    });
  }

  update(userId: string, id: string, dto: UpdateClientDto): Promise<Client> {
    return this.clientsRepository.manager.transaction(async (manager) => {
      const user = await this.lockAccount(manager, userId);
      const client = await manager.findOne(Client, { where: { id, userId } });
      if (!client) {
        throw new NotFoundException('Cliente no encontrado.');
      }

      if (dto.status === ClientStatus.Activo && client.status !== ClientStatus.Activo) {
        await this.ensureActiveClientSlot(manager, user);
      }

      return this.updateClient(manager, client, dto);
    });
  }

  private async lockAccount(manager: EntityManager, userId: string): Promise<User> {
    // Serializa los cambios de clientes por cuenta antes de contar los activos.
    const user = await manager.findOne(User, {
      where: { id: userId },
      select: { id: true, proUntil: true },
      lock: { mode: 'for_no_key_update' },
    });
    if (!user) {
      throw new NotFoundException('La cuenta no existe.');
    }
    return user;
  }

  private async ensureActiveClientSlot(manager: EntityManager, user: User): Promise<void> {
    if (hasProAccess(user.proUntil)) {
      return;
    }

    const count = await manager.count(Client, {
      where: { userId: user.id, status: ClientStatus.Activo },
    });
    if (count >= FREE_ACTIVE_CLIENT_LIMIT) {
      throw new ForbiddenException({
        reason: 'active_client_limit',
        message: `El plan Gratis permite hasta ${FREE_ACTIVE_CLIENT_LIMIT} clientes activos. Podés pasar otro cliente a Inactivo o activar Pro.`,
      });
    }
  }

  private updateClient(manager: EntityManager, client: Client, dto: UpdateClientDto): Promise<Client> {
    if (dto.name !== undefined) {
      client.name = dto.name.trim();
    }
    if (dto.email !== undefined) {
      client.email = dto.email.toLowerCase().trim();
    }
    if (dto.phone !== undefined) {
      client.phone = dto.phone;
    }
    if (dto.company !== undefined) {
      client.company = dto.company;
    }
    if (dto.cuilCuit !== undefined) {
      client.cuilCuit = dto.cuilCuit;
    }
    if (dto.currency !== undefined) {
      client.currency = dto.currency.toUpperCase();
    }
    if (dto.notes !== undefined) {
      client.notes = dto.notes;
    }
    if (dto.status != null) {
      client.status = dto.status;
    }

    return manager.save(client);
  }

  async remove(userId: string, id: string, cascade = false): Promise<void> {
    const client = await this.findOne(userId, id);

    // Los proyectos bloquean siempre la eliminación del cliente (no hay cascada).
    if (await this.hasProjects(userId, id)) {
      throw new ConflictException({
        message:
          'No puedes eliminar un cliente con proyectos asociados. Elimina primero sus proyectos.',
        reason: 'projects',
      });
    }

    if (cascade) {
      await this.removeWithQuotes(userId, id);
      return;
    }

    try {
      await this.clientsRepository.remove(client);
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new ConflictException({
          message:
            'No puedes eliminar un cliente con presupuestos asociados. Elimina primero sus presupuestos.',
          reason: 'quotes',
        });
      }
      throw error;
    }
  }

  /** Indica si el cliente tiene proyectos (siempre bloquean la eliminación). */
  private async hasProjects(userId: string, id: string): Promise<boolean> {
    const count = await this.clientsRepository.manager.count(Project, {
      where: { clientId: id, userId },
    });
    return count > 0;
  }

  /**
   * Borra el cliente y todos sus presupuestos en una sola transacción.
   * Los presupuestos se eliminan primero para satisfacer la FK `ON DELETE RESTRICT`;
   * las líneas (`quote_items`) caen por su propia FK `ON DELETE CASCADE`.
   */
  private async removeWithQuotes(userId: string, id: string): Promise<void> {
    await this.clientsRepository.manager.transaction(async (manager) => {
      await manager.delete(Quote, { clientId: id, userId });
      await manager.delete(Client, { id, userId });
    });
  }

  /** `23503` es el código de PostgreSQL para violación de clave foránea. */
  private isForeignKeyViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as { code?: string } | undefined;
    return driverError?.code === '23503';
  }
}
