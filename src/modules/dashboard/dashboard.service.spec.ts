import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  let service: DashboardService;
  let paymentRepository: { find: ReturnType<typeof vi.fn> };
  let projectRepository: { find: ReturnType<typeof vi.fn> };
  let quoteRepository: { count: ReturnType<typeof vi.fn> };
  let clientRepository: { count: ReturnType<typeof vi.fn> };

  const today = new Date();
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  beforeEach(() => {
    paymentRepository = { find: vi.fn() };
    projectRepository = { find: vi.fn() };
    quoteRepository = { count: vi.fn() };
    clientRepository = { count: vi.fn() };

    service = new DashboardService(
      paymentRepository as never,
      projectRepository as never,
      quoteRepository as never,
      clientRepository as never,
    );
  });

  it('calcula métricas, financiero por moneda y listas del resumen', async () => {
    paymentRepository.find.mockResolvedValue([
      {
        id: 'p1',
        number: 1,
        concept: 'Cuota 1',
        amount: '1000.00',
        currency: 'usd',
        dueDate: '2020-01-01',
        status: 'pendiente',
        paidAt: null,
        projectId: 'prj1',
        project: { name: 'Proyecto A', client: { name: 'Cliente A' } },
      },
      {
        id: 'p2',
        number: 2,
        concept: 'Cuota 2',
        amount: '500.00',
        currency: 'USD',
        dueDate: '2099-12-31',
        status: 'pendiente',
        paidAt: null,
        projectId: 'prj1',
        project: { name: 'Proyecto A', client: { name: 'Cliente A' } },
      },
      {
        id: 'p3',
        number: 3,
        concept: 'Cuota 3',
        amount: '2000.00',
        currency: 'USD',
        dueDate: todayStr,
        status: 'pagado',
        paidAt: today,
        projectId: 'prj2',
        project: { name: 'Proyecto B', client: { name: 'Cliente B' } },
      },
      {
        id: 'p4',
        number: 4,
        concept: 'Cuota 0',
        amount: '500.00',
        currency: 'USD',
        dueDate: '2020-01-01',
        status: 'pagado',
        paidAt: new Date('2020-01-01T12:00:00.000Z'),
        projectId: 'prj1',
        project: { name: 'Proyecto A', client: { name: 'Cliente A' } },
      },
    ]);

    projectRepository.find.mockResolvedValue([
      {
        id: 'prj1',
        number: 1,
        name: 'Proyecto A',
        status: 'en_progreso',
        budget: '1500.00',
        currency: 'usd',
        client: { name: 'Cliente A' },
      },
      {
        id: 'prj2',
        number: 2,
        name: 'Proyecto B',
        status: 'completado',
        budget: '2000.00',
        currency: 'USD',
        client: { name: 'Cliente B' },
      },
    ]);

    quoteRepository.count.mockResolvedValue(2);
    clientRepository.count.mockResolvedValue(5);

    const result = await service.getSummary('user-123');

    expect(paymentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-123' } }),
    );
    expect(projectRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-123' } }),
    );

    expect(result.financials).toEqual([
      {
        currency: 'USD',
        collectedThisMonth: 2000,
        pendingTotal: 1500,
        overdueTotal: 1000,
        overdueCount: 1,
      },
    ]);

    expect(result.metrics.activeProjectsCount).toBe(1);
    expect(result.metrics.pendingQuotesCount).toBe(2);
    expect(result.metrics.totalClientsCount).toBe(5);

    expect(result.upcomingPayments).toHaveLength(2);
    expect(result.upcomingPayments[0]).toMatchObject({ id: 'p1', isOverdue: true });

    // Solo se listan proyectos en progreso, con lo cobrado de sus cuotas.
    expect(result.recentProjects).toHaveLength(1);
    expect(result.recentProjects[0]).toMatchObject({
      code: 'PRY-0001',
      collectedAmount: 500,
      currency: 'USD',
    });
  });

  it('agrupa los totales por moneda sin mezclarlas', async () => {
    paymentRepository.find.mockResolvedValue([
      {
        id: 'p1',
        number: 1,
        concept: 'Cuota USD',
        amount: '100.00',
        currency: 'USD',
        dueDate: '2099-12-31',
        status: 'pendiente',
        paidAt: null,
        project: null,
      },
      {
        id: 'p2',
        number: 2,
        concept: 'Cuota EUR',
        amount: '80.00',
        currency: 'EUR',
        dueDate: '2020-01-01',
        status: 'pendiente',
        paidAt: null,
        project: null,
      },
    ]);
    projectRepository.find.mockResolvedValue([]);
    quoteRepository.count.mockResolvedValue(0);
    clientRepository.count.mockResolvedValue(0);

    const result = await service.getSummary('user-123');

    expect(result.financials).toEqual([
      {
        currency: 'EUR',
        collectedThisMonth: 0,
        pendingTotal: 80,
        overdueTotal: 80,
        overdueCount: 1,
      },
      {
        currency: 'USD',
        collectedThisMonth: 0,
        pendingTotal: 100,
        overdueTotal: 0,
        overdueCount: 0,
      },
    ]);
    expect(result.upcomingPayments).toHaveLength(2);
  });
});
