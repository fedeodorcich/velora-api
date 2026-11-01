import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '../clients/entities/client.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { QuoteItem } from '../quotes/entities/quote-item.entity.js';
import { Quote } from '../quotes/entities/quote.entity.js';
import { User } from '../users/entities/user.entity.js';
import { DEMO_EMAIL, DEMO_PASSWORD, SeedService } from './seed.service.js';

const mockState = vi.hoisted(() => ({ enabled: true, production: false }));

vi.mock('../../core/config/env.js', () => ({
  env: {
    get isProduction() {
      return mockState.production;
    },
    testing: {
      get seedEnabled() {
        return mockState.enabled;
      },
    },
  },
}));

describe('SeedService', () => {
  let service: SeedService;
  let clientsService: { create: ReturnType<typeof vi.fn> };
  let quotesService: { create: ReturnType<typeof vi.fn> };
  let projectsService: {
    create: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let paymentsService: {
    create: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let usersService: {
    create: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
  };
  let dashboardService: { getSummary: ReturnType<typeof vi.fn> };
  let manager: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockState.enabled = true;
    mockState.production = false;

    let sequence = 0;
    const nextId = (prefix: string): string => `${prefix}-${++sequence}`;

    clientsService = {
      create: vi.fn((userId: string, dto: Record<string, unknown>) =>
        Promise.resolve({ id: nextId('client'), userId, ...dto }),
      ),
    };
    quotesService = {
      create: vi.fn((userId: string, dto: { items: Array<{ quantity: number; unitPrice: number }> }) =>
        Promise.resolve({
          id: nextId('quote'),
          userId,
          ...dto,
          total: dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        }),
      ),
    };
    projectsService = {
      create: vi.fn((userId: string, dto: Record<string, unknown>) =>
        Promise.resolve({ id: nextId('project'), userId, ...dto }),
      ),
      updateStatus: vi.fn((_userId: string, id: string, status: string) =>
        Promise.resolve({ id, status }),
      ),
    };
    paymentsService = {
      create: vi.fn((userId: string, dto: Record<string, unknown>) =>
        Promise.resolve({ id: nextId('payment'), userId, ...dto }),
      ),
      updateStatus: vi.fn((_userId: string, id: string, status: string) =>
        Promise.resolve({ id, status }),
      ),
    };
    usersService = {
      create: vi.fn(() => Promise.resolve({ id: 'demo-user' })),
      findByEmail: vi.fn(),
    };
    dashboardService = {
      getSummary: vi.fn(() =>
        Promise.resolve({
          metrics: { activeProjectsCount: 2, pendingQuotesCount: 1, totalClientsCount: 3 },
          financials: [],
          upcomingPayments: [],
          recentProjects: [],
        }),
      ),
    };
    manager = {
      findOne: vi.fn(() => Promise.resolve({ id: 'old-demo' })),
      find: vi.fn(() => Promise.resolve([{ id: 'old-quote' }])),
      delete: vi.fn(() => Promise.resolve({ affected: 1 })),
    };
    dataSource = {
      transaction: vi.fn((callback: (manager: typeof manager) => Promise<void>) => callback(manager)),
    };

    service = new SeedService(
      clientsService as never,
      quotesService as never,
      projectsService as never,
      paymentsService as never,
      usersService as never,
      dashboardService as never,
      dataSource as never,
    );
  });

  it('resetea el demo y crea el set completo de datos', async () => {
    const result = await service.seedDemo();

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.delete).toHaveBeenNthCalledWith(1, Payment, { userId: 'old-demo' });
    expect(manager.delete).toHaveBeenNthCalledWith(2, Project, { userId: 'old-demo' });
    expect(manager.delete).toHaveBeenNthCalledWith(
      3,
      QuoteItem,
      expect.objectContaining({ quoteId: expect.anything() }),
    );
    expect(manager.delete).toHaveBeenNthCalledWith(4, Quote, { userId: 'old-demo' });
    expect(manager.delete).toHaveBeenNthCalledWith(5, Client, { userId: 'old-demo' });
    expect(manager.delete).toHaveBeenNthCalledWith(6, User, { id: 'old-demo' });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: DEMO_EMAIL,
        name: 'Estudio Demo',
        passwordHash: expect.not.stringContaining(DEMO_PASSWORD),
      }),
    );
    expect(usersService.create.mock.calls[0][0].passwordHash).toMatch(/^scrypt\$/);

    expect(clientsService.create).toHaveBeenCalledTimes(3);
    expect(quotesService.create).toHaveBeenCalledTimes(7);
    expect(projectsService.create).toHaveBeenCalledTimes(4);
    expect(projectsService.updateStatus).toHaveBeenCalledTimes(3);
    expect(paymentsService.create).toHaveBeenCalledTimes(7);
    expect(paymentsService.updateStatus).toHaveBeenCalledTimes(3);

    expect(result.user).toEqual({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(result.counts).toEqual({ clients: 3, quotes: 7, projects: 4, payments: 7 });
    expect(result.dashboard.metrics.activeProjectsCount).toBe(2);
    expect(dashboardService.getSummary).toHaveBeenCalledWith('demo-user');
  });

  it('responde 404 si el seed está deshabilitado', async () => {
    mockState.enabled = false;

    await expect(service.seedDemo()).rejects.toBeInstanceOf(NotFoundException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('responde 404 en producción aunque la flag esté activa', async () => {
    mockState.production = true;

    await expect(service.seedDemo()).rejects.toBeInstanceOf(NotFoundException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('elimina el demo solo si existe', async () => {
    usersService.findByEmail.mockResolvedValueOnce(null);
    await expect(service.removeDemo()).resolves.toEqual({ removed: false });
    expect(dataSource.transaction).not.toHaveBeenCalled();

    usersService.findByEmail.mockResolvedValueOnce({ id: 'old-demo' });
    await expect(service.removeDemo()).resolves.toEqual({ removed: true });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });
});
