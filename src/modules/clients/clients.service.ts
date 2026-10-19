import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity.js';
import { Quote } from '../quotes/entities/quote.entity.js';
import { Client } from './entities/client.entity.js';
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
      status: dto.status,
    });
    return this.clientsRepository.save(client);
  }

  async update(userId: string, id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(userId, id);

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
    if (dto.status !== undefined) {
      client.status = dto.status;
    }

    return this.clientsRepository.save(client);
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
