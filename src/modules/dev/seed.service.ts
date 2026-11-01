import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { env } from '../../core/config/env.js';
import { hashPassword } from '../../core/security/password.js';
import { ClientsService } from '../clients/clients.service.js';
import { Client, ClientStatus } from '../clients/entities/client.entity.js';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity.js';
import { PaymentsService } from '../payments/payments.service.js';
import { Project, ProjectStatus } from '../projects/entities/project.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
import { QuoteItem } from '../quotes/entities/quote-item.entity.js';
import { Quote, QuoteStatus } from '../quotes/entities/quote.entity.js';
import { QuotesService, type QuoteWithItems } from '../quotes/quotes.service.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { SeedDeleteResultDto, SeedResultDto } from './dto/seed-result.dto.js';

export const DEMO_EMAIL = 'demo@velora.local';
export const DEMO_PASSWORD = 'Demo1234!';

/** Fecha ISO corta (`YYYY-MM-DD`) desplazada `days` días desde hoy, en hora local. */
function isoDateFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

interface SeedClients {
  acme: Client;
  nordika: Client;
  lucia: Client;
}

interface SeedQuotes {
  rediseno: QuoteWithItems;
  identidad: QuoteWithItems;
  landing: QuoteWithItems;
  personal: QuoteWithItems;
  plantillas: QuoteWithItems;
  panel: QuoteWithItems;
  mantenimiento: QuoteWithItems;
}

/**
 * Seed de datos demo para desarrollo.
 *
 * El endpoint queda oculto (404) salvo que `TEST_SEED_ENABLED=true` y no se esté
 * en producción. Cada llamada resetea el usuario demo y vuelve a crear el set,
 * por lo que es idempotente y nunca toca cuentas reales.
 */
@Injectable()
export class SeedService {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly quotesService: QuotesService,
    private readonly projectsService: ProjectsService,
    private readonly paymentsService: PaymentsService,
    private readonly usersService: UsersService,
    private readonly dashboardService: DashboardService,
    private readonly dataSource: DataSource,
  ) {}

  async seedDemo(): Promise<SeedResultDto> {
    this.assertEnabled();
    await this.removeDemoData();

    const user = await this.usersService.create({
      email: DEMO_EMAIL,
      name: 'Estudio Demo',
      passwordHash: await hashPassword(DEMO_PASSWORD),
    });

    const { clients, quotes, projects, payments } = await this.createDemoData(user.id);
    const dashboard = await this.dashboardService.getSummary(user.id);

    return {
      user: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
      counts: { clients, quotes, projects, payments },
      dashboard,
    };
  }

  async removeDemo(): Promise<SeedDeleteResultDto> {
    this.assertEnabled();

    const user = await this.usersService.findByEmail(DEMO_EMAIL);
    if (!user) {
      return { removed: false };
    }

    await this.removeDemoData();
    return { removed: true };
  }

  private assertEnabled(): void {
    if (env.isProduction || !env.testing.seedEnabled) {
      // 404 para no revelar la existencia del endpoint cuando está deshabilitado.
      throw new NotFoundException();
    }
  }

  /** Borra en orden los datos del demo para satisfacer las FKs `RESTRICT`. */
  private async removeDemoData(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { email: DEMO_EMAIL } });
      if (!user) {
        return;
      }

      const quotes = await manager.find(Quote, {
        where: { userId: user.id },
        select: { id: true },
      });

      await manager.delete(Payment, { userId: user.id });
      await manager.delete(Project, { userId: user.id });
      if (quotes.length > 0) {
        await manager.delete(QuoteItem, { quoteId: In(quotes.map((quote) => quote.id)) });
      }
      await manager.delete(Quote, { userId: user.id });
      await manager.delete(Client, { userId: user.id });
      await manager.delete(User, { id: user.id });
    });
  }

  private async createDemoData(
    userId: string,
  ): Promise<{ clients: number; quotes: number; projects: number; payments: number }> {
    const clients = await this.createClients(userId);
    const quotes = await this.createQuotes(userId, clients);
    const projectIds = await this.createProjects(userId, quotes);
    const payments = await this.createPayments(userId, projectIds);

    return { clients: 3, quotes: 7, projects: 4, payments };
  }

  private async createClients(userId: string): Promise<SeedClients> {
    const acme = await this.clientsService.create(userId, {
      name: 'Marina Ruiz',
      email: 'marina@acme.test',
      company: 'Acme Studio',
      cuilCuit: '20-12345678-9',
      currency: 'USD',
      status: ClientStatus.Activo,
      notes: 'Cliente demo con dos proyectos en curso.',
    });

    const nordika = await this.clientsService.create(userId, {
      name: 'Lucas Fernández',
      email: 'lucas@nordika.test',
      company: 'Nordika Diseño',
      currency: 'EUR',
      status: ClientStatus.Activo,
    });

    const lucia = await this.clientsService.create(userId, {
      name: 'Lucía Pérez',
      email: 'lucia@personal.test',
      currency: 'USD',
      status: ClientStatus.Lead,
    });

    return { acme, nordika, lucia };
  }

  private async createQuotes(userId: string, clients: SeedClients): Promise<SeedQuotes> {
    const rediseno = await this.quotesService.create(userId, {
      clientId: clients.acme.id,
      title: 'Rediseño de tienda online',
      status: QuoteStatus.Aceptado,
      taxRate: 21,
      issueDate: isoDateFromNow(-50),
      items: [
        { description: 'Diseño UX/UI de la tienda', quantity: 1, unitPrice: 800 },
        { description: 'Implementación responsive', quantity: 1, unitPrice: 400 },
      ],
    });

    const identidad = await this.quotesService.create(userId, {
      clientId: clients.nordika.id,
      title: 'Identidad visual',
      status: QuoteStatus.Aceptado,
      taxRate: 0,
      issueDate: isoDateFromNow(-35),
      items: [{ description: 'Manual de marca y assets', quantity: 1, unitPrice: 800 }],
    });

    const landing = await this.quotesService.create(userId, {
      clientId: clients.acme.id,
      title: 'Landing de campaña',
      status: QuoteStatus.Enviado,
      taxRate: 21,
      issueDate: isoDateFromNow(-3),
      items: [{ description: 'Landing + formulario', quantity: 1, unitPrice: 450 }],
    });

    const personal = await this.quotesService.create(userId, {
      clientId: clients.lucia.id,
      title: 'Sitio personal',
      status: QuoteStatus.Borrador,
      taxRate: 0,
      issueDate: isoDateFromNow(-1),
      items: [{ description: 'Portfolio one-page', quantity: 1, unitPrice: 300 }],
    });

    const plantillas = await this.quotesService.create(userId, {
      clientId: clients.nordika.id,
      title: 'Pack de plantillas',
      status: QuoteStatus.Rechazado,
      taxRate: 0,
      issueDate: isoDateFromNow(-20),
      items: [{ description: 'Set de 5 plantillas', quantity: 1, unitPrice: 200 }],
    });

    const panel = await this.quotesService.create(userId, {
      clientId: clients.acme.id,
      title: 'Panel de administración',
      status: QuoteStatus.Aceptado,
      taxRate: 21,
      issueDate: isoDateFromNow(-10),
      items: [{ description: 'Dashboard interno', quantity: 1, unitPrice: 600 }],
    });

    const mantenimiento = await this.quotesService.create(userId, {
      clientId: clients.acme.id,
      title: 'Mantenimiento anual',
      status: QuoteStatus.Aceptado,
      taxRate: 0,
      issueDate: isoDateFromNow(-120),
      items: [{ description: 'Soporte y actualizaciones', quantity: 1, unitPrice: 900 }],
    });

    return { rediseno, identidad, landing, personal, plantillas, panel, mantenimiento };
  }

  private async createProjects(
    userId: string,
    quotes: SeedQuotes,
  ): Promise<{ rediseno: string; identidad: string; panel: string; mantenimiento: string }> {
    const rediseno = await this.projectsService.create(userId, {
      quoteId: quotes.rediseno.id,
      progress: 45,
      startDate: isoDateFromNow(-45),
      dueDate: isoDateFromNow(15),
      description: 'Rediseño integral de la tienda con checkout simplificado.',
    });
    await this.projectsService.updateStatus(userId, rediseno.id, ProjectStatus.EnProgreso);

    const identidad = await this.projectsService.create(userId, {
      quoteId: quotes.identidad.id,
      progress: 30,
      startDate: isoDateFromNow(-30),
      dueDate: isoDateFromNow(25),
      description: 'Nueva identidad y aplicación en piezas digitales.',
    });
    await this.projectsService.updateStatus(userId, identidad.id, ProjectStatus.EnProgreso);

    const panel = await this.projectsService.create(userId, {
      quoteId: quotes.panel.id,
      progress: 0,
      startDate: isoDateFromNow(7),
      dueDate: isoDateFromNow(60),
      description: 'Panel interno para gestión de pedidos.',
    });

    const mantenimiento = await this.projectsService.create(userId, {
      quoteId: quotes.mantenimiento.id,
      progress: 100,
      startDate: isoDateFromNow(-120),
      dueDate: isoDateFromNow(-30),
      description: 'Soporte y mantenimiento del último año.',
    });
    await this.projectsService.updateStatus(userId, mantenimiento.id, ProjectStatus.Finalizado);

    return {
      rediseno: rediseno.id,
      identidad: identidad.id,
      panel: panel.id,
      mantenimiento: mantenimiento.id,
    };
  }

  private async createPayments(
    userId: string,
    projects: { rediseno: string; identidad: string; panel: string; mantenimiento: string },
  ): Promise<number> {
    const paidRediseno = await this.paymentsService.create(userId, {
      projectId: projects.rediseno,
      concept: 'Anticipo del rediseño',
      amount: 500,
      dueDate: isoDateFromNow(-40),
      method: 'Transferencia',
    });
    await this.paymentsService.updateStatus(userId, paidRediseno.id, PaymentStatus.Pagado);

    await this.paymentsService.create(userId, {
      projectId: projects.rediseno,
      concept: 'Segunda cuota',
      amount: 400,
      dueDate: isoDateFromNow(-5),
    });

    await this.paymentsService.create(userId, {
      projectId: projects.rediseno,
      concept: 'Saldo final',
      amount: 300,
      dueDate: isoDateFromNow(20),
    });

    const paidIdentidad = await this.paymentsService.create(userId, {
      projectId: projects.identidad,
      concept: 'Anticipo de identidad',
      amount: 300,
      dueDate: isoDateFromNow(-60),
      method: 'Transferencia',
    });
    await this.paymentsService.updateStatus(userId, paidIdentidad.id, PaymentStatus.Pagado);

    await this.paymentsService.create(userId, {
      projectId: projects.identidad,
      concept: 'Cuota vencida',
      amount: 200,
      dueDate: isoDateFromNow(-10),
    });

    await this.paymentsService.create(userId, {
      projectId: projects.identidad,
      concept: 'Entrega de manual',
      amount: 300,
      dueDate: isoDateFromNow(30),
    });

    const paidMantenimiento = await this.paymentsService.create(userId, {
      projectId: projects.mantenimiento,
      concept: 'Mantenimiento anual',
      amount: 900,
      dueDate: isoDateFromNow(-90),
      method: 'Transferencia',
    });
    await this.paymentsService.updateStatus(userId, paidMantenimiento.id, PaymentStatus.Pagado);

    return 7;
  }
}
