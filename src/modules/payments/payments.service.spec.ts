import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Project, ProjectStatus } from '../projects/entities/project.entity.js';
import { Payment, PaymentStatus } from './entities/payment.entity.js';
import { PaymentsService } from './payments.service.js';

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    userId: 'user-1',
    clientId: 'client-1',
    quoteId: null,
    number: 1,
    name: 'Rediseño de landing',
    status: ProjectStatus.Planificado,
    currency: 'USD',
    budget: 500,
    progress: 0,
    startDate: null,
    dueDate: null,
    description: null,
    notes: null,
    user: undefined as unknown as Project['user'],
    client: undefined as unknown as Project['client'],
    quote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    userId: 'user-1',
    projectId: 'project-1',
    number: 1,
    concept: 'Anticipo',
    amount: 250,
    currency: 'USD',
    dueDate: '2026-11-01',
    status: PaymentStatus.Pendiente,
    paidAt: null,
    method: null,
    notes: null,
    user: undefined as unknown as Payment['user'],
    project: undefined as unknown as Payment['project'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;

  const paymentRepositoryMock = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((data: Partial<Payment>) => data as Payment),
    save: vi.fn((data: Payment) => Promise.resolve(data)),
    remove: vi.fn(),
  };
  const projectRepositoryMock = {
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepositoryMock },
        { provide: getRepositoryToken(Project), useValue: projectRepositoryMock },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('lista únicamente los cobros del usuario autenticado', async () => {
    paymentRepositoryMock.find.mockResolvedValue([buildPayment()]);

    const result = await service.findAll('user-1');

    expect(paymentRepositoryMock.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      relations: { project: { client: true } },
      order: { dueDate: 'ASC', number: 'ASC' },
    });
    expect(result).toHaveLength(1);
  });

  it('lanza NotFound cuando el cobro no pertenece al usuario', async () => {
    paymentRepositoryMock.findOne.mockResolvedValue(null);

    await expect(service.findOne('user-1', 'payment-ajeno')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('crea un cobro derivando la moneda del proyecto', async () => {
    projectRepositoryMock.findOne.mockResolvedValue(buildProject({ currency: 'eur' }));
    paymentRepositoryMock.findOne.mockResolvedValue(null);

    const result = await service.create('user-1', {
      projectId: 'project-1',
      concept: '  Anticipo  ',
      amount: 250,
      dueDate: '2026-11-01',
    });

    expect(projectRepositoryMock.findOne).toHaveBeenCalledWith({
      where: { id: 'project-1', userId: 'user-1' },
    });
    expect(result.userId).toBe('user-1');
    expect(result.projectId).toBe('project-1');
    expect(result.concept).toBe('Anticipo');
    expect(result.currency).toBe('EUR');
    expect(result.amount).toBe(250);
    expect(result.status).toBe(PaymentStatus.Pendiente);
    expect(result.paidAt).toBeNull();
    expect(result.number).toBe(1);
  });

  it('lanza NotFound si el proyecto no pertenece al usuario', async () => {
    projectRepositoryMock.findOne.mockResolvedValue(null);

    await expect(
      service.create('user-1', {
        projectId: 'project-ajeno',
        concept: 'Anticipo',
        amount: 250,
        dueDate: '2026-11-01',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('asigna el correlativo siguiente dentro del usuario', async () => {
    projectRepositoryMock.findOne.mockResolvedValue(buildProject());
    paymentRepositoryMock.findOne.mockResolvedValue(buildPayment({ number: 3 }));

    const result = await service.create('user-1', {
      projectId: 'project-1',
      concept: 'Cuota 4',
      amount: 100,
      dueDate: '2026-12-01',
    });

    expect(result.number).toBe(4);
  });

  it('marca pagado seteando la fecha de pago', async () => {
    paymentRepositoryMock.findOne.mockResolvedValue(buildPayment());

    const result = await service.updateStatus('user-1', 'payment-1', PaymentStatus.Pagado);

    expect(result.status).toBe(PaymentStatus.Pagado);
    expect(result.paidAt).toBeInstanceOf(Date);
  });

  it('vuelve a pendiente limpiando la fecha de pago', async () => {
    paymentRepositoryMock.findOne.mockResolvedValue(
      buildPayment({ status: PaymentStatus.Pagado, paidAt: new Date() }),
    );

    const result = await service.updateStatus('user-1', 'payment-1', PaymentStatus.Pendiente);

    expect(result.status).toBe(PaymentStatus.Pendiente);
    expect(result.paidAt).toBeNull();
  });

  it('elimina el cobro del usuario autenticado', async () => {
    const existing = buildPayment();
    paymentRepositoryMock.findOne.mockResolvedValue(existing);
    paymentRepositoryMock.remove.mockResolvedValue(existing);

    await service.remove('user-1', 'payment-1');

    expect(paymentRepositoryMock.remove).toHaveBeenCalledWith(existing);
  });
});
