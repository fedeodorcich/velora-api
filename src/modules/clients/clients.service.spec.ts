import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, type TestingModule } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../users/entities/user.entity.js';
import { Quote } from '../quotes/entities/quote.entity.js';
import { ClientsService } from './clients.service.js';
import { Client, ClientStatus } from './entities/client.entity.js';

function buildClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    userId: 'user-1',
    name: 'Estudio Norte',
    email: 'hola@estudionorte.test',
    phone: null,
    company: null,
    cuilCuit: null,
    currency: 'USD',
    notes: null,
    status: ClientStatus.Lead,
    user: undefined as unknown as Client['user'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ClientsService', () => {
  let service: ClientsService;
  const transactionManagerMock = {
    delete: vi.fn(),
    findOne: vi.fn(),
    count: vi.fn(),
    save: vi.fn(),
  };
  const repositoryMock = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    manager: {
      count: vi.fn(),
      transaction: vi.fn((work: (manager: typeof transactionManagerMock) => Promise<void>) =>
        work(transactionManagerMock),
      ),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: repositoryMock },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  it('lista únicamente los clientes del usuario autenticado', async () => {
    repositoryMock.find.mockResolvedValue([buildClient()]);

    const result = await service.findAll('user-1');

    expect(repositoryMock.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'DESC' },
    });
    expect(result).toHaveLength(1);
  });

  it('lanza NotFound cuando el cliente no pertenece al usuario', async () => {
    repositoryMock.findOne.mockResolvedValue(null);

    await expect(service.findOne('user-1', 'client-ajeno')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repositoryMock.findOne).toHaveBeenCalledWith({
      where: { id: 'client-ajeno', userId: 'user-1' },
    });
  });

  it('crea un cliente asignando el userId del usuario autenticado', async () => {
    repositoryMock.create.mockImplementation((data: Partial<Client>) => data as Client);
    repositoryMock.save.mockImplementation((client: Client) => Promise.resolve(client));

    await service.create('user-1', {
      name: '  Estudio Norte  ',
      email: 'HOLA@estudionorte.test',
      currency: 'eur',
    });

    expect(repositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        name: 'Estudio Norte',
        email: 'hola@estudionorte.test',
        currency: 'EUR',
      }),
    );
  });

  it('usa USD por defecto cuando no se indica moneda', async () => {
    repositoryMock.create.mockImplementation((data: Partial<Client>) => data as Client);
    repositoryMock.save.mockImplementation((client: Client) => Promise.resolve(client));

    await service.create('user-1', {
      name: 'Estudio Norte',
      email: 'hola@estudionorte.test',
    });

    expect(repositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
  });

  it('actualiza solo los campos enviados', async () => {
    const existing = buildClient();
    transactionManagerMock.findOne.mockImplementation((entity) =>
      Promise.resolve(entity === User ? { id: 'user-1', proUntil: null } : existing),
    );
    transactionManagerMock.count.mockResolvedValue(0);
    transactionManagerMock.save.mockImplementation((client: Client) => Promise.resolve(client));

    const result = await service.update('user-1', 'client-1', { status: ClientStatus.Activo });

    expect(result.status).toBe(ClientStatus.Activo);
    expect(result.name).toBe('Estudio Norte');
    expect(result.email).toBe('hola@estudionorte.test');
  });

  it('rechaza la reactivación al alcanzar el cupo del plan Gratis', async () => {
    transactionManagerMock.findOne.mockImplementation((entity) =>
      Promise.resolve(entity === User ? { id: 'user-1', proUntil: new Date(0) } : buildClient()),
    );
    transactionManagerMock.count.mockResolvedValue(5);

    await expect(service.update('user-1', 'client-1', { status: ClientStatus.Activo })).rejects.toMatchObject({
      response: { reason: 'active_client_limit' },
    });
    expect(transactionManagerMock.count).toHaveBeenCalledWith(Client, {
      where: { userId: 'user-1', status: ClientStatus.Activo },
    });
    expect(transactionManagerMock.save).not.toHaveBeenCalled();
  });

  it('permite activar un cliente si Pro está vigente', async () => {
    transactionManagerMock.findOne.mockImplementation((entity) =>
      Promise.resolve(
        entity === User ? { id: 'user-1', proUntil: new Date(Date.now() + 60_000) } : buildClient(),
      ),
    );
    transactionManagerMock.save.mockImplementation((client: Client) => Promise.resolve(client));

    const result = await service.update('user-1', 'client-1', { status: ClientStatus.Activo });

    expect(result.status).toBe(ClientStatus.Activo);
    expect(transactionManagerMock.count).not.toHaveBeenCalled();
  });

  it('elimina el cliente del usuario autenticado', async () => {
    const existing = buildClient();
    repositoryMock.findOne.mockResolvedValue(existing);
    repositoryMock.remove.mockResolvedValue(existing);

    await service.remove('user-1', 'client-1');

    expect(repositoryMock.remove).toHaveBeenCalledWith(existing);
  });

  it('lanza Conflict (409) si el cliente tiene presupuestos y no se fuerza la cascada', async () => {
    const existing = buildClient();
    repositoryMock.findOne.mockResolvedValue(existing);
    repositoryMock.manager.count.mockResolvedValue(0);
    repositoryMock.remove.mockRejectedValue(
      new QueryFailedError('DELETE FROM clients', [], { code: '23503' } as unknown as Error),
    );

    await expect(service.remove('user-1', 'client-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('lanza Conflict (409) con motivo proyectos aunque se fuerce la cascada', async () => {
    const existing = buildClient();
    repositoryMock.findOne.mockResolvedValue(existing);
    repositoryMock.manager.count.mockResolvedValue(2);

    await expect(service.remove('user-1', 'client-1', true)).rejects.toMatchObject({
      response: { reason: 'projects' },
    });
    expect(repositoryMock.manager.transaction).not.toHaveBeenCalled();
    expect(repositoryMock.remove).not.toHaveBeenCalled();
  });

  it('borra el cliente y sus presupuestos en una transacción cuando cascade es true', async () => {
    const existing = buildClient();
    repositoryMock.findOne.mockResolvedValue(existing);
    repositoryMock.manager.count.mockResolvedValue(0);
    transactionManagerMock.delete.mockResolvedValue({ affected: 1 });

    await service.remove('user-1', 'client-1', true);

    expect(repositoryMock.manager.transaction).toHaveBeenCalledTimes(1);
    expect(transactionManagerMock.delete).toHaveBeenNthCalledWith(1, Quote, {
      clientId: 'client-1',
      userId: 'user-1',
    });
    expect(transactionManagerMock.delete).toHaveBeenNthCalledWith(2, Client, {
      id: 'client-1',
      userId: 'user-1',
    });
    expect(repositoryMock.remove).not.toHaveBeenCalled();
  });

  it('no borra un cliente ajeno aunque se fuerce la cascada', async () => {
    repositoryMock.findOne.mockResolvedValue(null);

    await expect(service.remove('user-1', 'client-ajeno', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(transactionManagerMock.delete).not.toHaveBeenCalled();
  });
});
