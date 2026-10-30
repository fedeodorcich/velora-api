import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity.js';
import { Project, ProjectStatus } from '../projects/entities/project.entity.js';
import { Quote, QuoteStatus } from '../quotes/entities/quote.entity.js';
import { Client } from '../clients/entities/client.entity.js';
import {
  DashboardFinancialSummaryDto,
  DashboardSummaryDto,
} from './dto/dashboard-summary.dto.js';

/** Fecha local de hoy en formato ISO corto (`YYYY-MM-DD`), sin desfase por zona horaria. */
function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  async getSummary(userId: string): Promise<DashboardSummaryDto> {
    const now = new Date();
    const today = todayIso(now);
    const monthPrefix = today.slice(0, 7);

    const payments = await this.paymentRepository.find({
      where: { userId },
      relations: { project: { client: true } },
      order: { dueDate: 'ASC' },
    });

    const financials = new Map<string, DashboardFinancialSummaryDto>();
    const upcomingPayments: DashboardSummaryDto['upcomingPayments'] = [];
    /** Total cobrado por proyecto, para el avance financiero de cada ficha. */
    const collectedByProject = new Map<string, number>();

    for (const payment of payments) {
      const currency = payment.currency.toUpperCase();
      const financial = financials.get(currency) ?? {
        currency,
        collectedThisMonth: 0,
        pendingTotal: 0,
        overdueTotal: 0,
        overdueCount: 0,
      };
      financials.set(currency, financial);

      const amount = Number(payment.amount) || 0;

      if (payment.status === PaymentStatus.Pagado) {
        collectedByProject.set(
          payment.projectId,
          (collectedByProject.get(payment.projectId) ?? 0) + amount,
        );
        // `paidAt` es un timestamptz: comparamos el mes local del pago.
        if (payment.paidAt && todayIso(new Date(payment.paidAt)).startsWith(monthPrefix)) {
          financial.collectedThisMonth += amount;
        }
        continue;
      }

      financial.pendingTotal += amount;

      const isOverdue = payment.dueDate < today;
      if (isOverdue) {
        financial.overdueTotal += amount;
        financial.overdueCount++;
      }

      if (upcomingPayments.length < 5) {
        upcomingPayments.push({
          id: payment.id,
          number: payment.number,
          concept: payment.concept,
          amount,
          currency,
          dueDate: payment.dueDate,
          status: payment.status,
          isOverdue,
          projectName: payment.project?.name ?? '',
          clientName: payment.project?.client?.name ?? '',
        });
      }
    }

    const projects = await this.projectRepository.find({
      where: { userId },
      relations: { client: true },
      order: { createdAt: 'DESC' },
    });

    const activeProjects = projects.filter(
      (project) => project.status === ProjectStatus.EnProgreso,
    );

    const recentProjects = activeProjects.slice(0, 5).map((project) => {
      return {
        id: project.id,
        code: `PRY-${String(project.number).padStart(4, '0')}`,
        name: project.name,
        clientName: project.client?.name ?? '',
        status: project.status,
        budget: Number(project.budget) || 0,
        collectedAmount: collectedByProject.get(project.id) ?? 0,
        currency: project.currency.toUpperCase(),
      };
    });

    const [pendingQuotesCount, totalClientsCount] = await Promise.all([
      this.quoteRepository.count({
        where: { userId, status: QuoteStatus.Enviado },
      }),
      this.clientRepository.count({ where: { userId } }),
    ]);

    return {
      metrics: {
        activeProjectsCount: activeProjects.length,
        pendingQuotesCount,
        totalClientsCount,
      },
      financials: [...financials.values()].sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      upcomingPayments,
      recentProjects,
    };
  }
}
