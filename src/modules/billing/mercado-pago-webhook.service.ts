import { paidMonthUntil } from '../../core/billing/paid-month.js';
export { paidMonthUntil } from '../../core/billing/paid-month.js';
import { MercadoPagoPurchaseService } from './mercado-pago-purchase.service.js';
import {
  BadGatewayException, BadRequestException, Injectable, Logger, ServiceUnavailableException,
  type OnModuleDestroy, type OnModuleInit,
} from '@nestjs/common';
import { DataSource, EntityManager, LessThanOrEqual } from 'typeorm';
import { env } from '../../core/config/env.js';
import { User } from '../users/entities/user.entity.js';
import { BillingWebhookJob } from './entities/billing-webhook-job.entity.js';
import { SubscriptionPayment } from './entities/subscription-payment.entity.js';
import { verifyMercadoPagoSignature } from './mercado-pago-signature.js';

interface ProviderSubscription {
  id: string;
  external_reference: string;
  collector_id: number;
  status: string;
  auto_recurring: {
    transaction_amount: number;
    currency_id: string;
    frequency: number;
    frequency_type: string;
  };
}

interface ProviderPayment {
  id: number;
  external_reference: string;
  collector_id: number;
  status: string;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  currency_id: string;
  date_approved: string | null;
  point_of_interaction?: { transaction_data?: { subscription_id?: string } };
}

const TOPICS = new Set(['payment', 'subscription_preapproval', 'subscription_authorized_payment']);

@Injectable()
export class MercadoPagoWebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MercadoPagoWebhookService.name);
  private timer?: ReturnType<typeof setInterval>;
  private work?: Promise<void>;

  constructor(private readonly db: DataSource, private readonly purchases: MercadoPagoPurchaseService) {}

  onModuleInit(): void {
    if (env.nodeEnv === 'test' || !env.mercadoPagoWebhook.secret || !env.mercadoPagoTest) {
      return;
    }
    this.timer = setInterval(() => {
      if (!this.work) {
        this.work = this.processNext().catch(() => {
          this.logger.error('No se pudo procesar la cola de Mercado Pago. Se reintentará.');
        }).finally(() => { this.work = undefined; });
      }
    }, 2000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.work;
  }

  async receive(
    topic: string,
    bodyId: string,
    queryId: string | undefined,
    signature: string | undefined,
    requestId: string | undefined,
  ): Promise<void> {
    const secret = env.mercadoPagoWebhook.secret;
    if (!secret || !env.mercadoPagoTest) {
      throw new ServiceUnavailableException('Las notificaciones de Mercado Pago no están configuradas.');
    }
    if (queryId !== undefined && (typeof queryId !== 'string' || queryId.toLowerCase() !== bodyId.toLowerCase())) {
      throw new BadRequestException('El identificador de la notificación no coincide.');
    }
    verifyMercadoPagoSignature(secret, queryId ?? bodyId, signature, requestId);
    if (!TOPICS.has(topic)) {
      return;
    }
    const resourceId = bodyId.toLowerCase();
    await this.db.getRepository(BillingWebhookJob).upsert({
      id: `${topic}:${resourceId}`,
      topic,
      resourceId,
      pending: true,
      attempts: 0,
      nextAttemptAt: new Date(),
    }, ['id']);
  }

  async processNext(): Promise<void> {
    await this.db.transaction(async (manager) => {
      const job = await manager.findOne(BillingWebhookJob, {
        where: { pending: true, nextAttemptAt: LessThanOrEqual(new Date()) },
        order: { nextAttemptAt: 'ASC' },
        lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
      });
      if (!job) {
        return;
      }
      // El savepoint permite guardar el reintento aunque falle una escritura del procesamiento.
      await manager.queryRunner!.startTransaction();
      try {
        await this.processResource(manager, job);
        await manager.queryRunner!.commitTransaction();
        job.pending = false;
        job.attempts = 0;
      } catch {
        await manager.queryRunner!.rollbackTransaction();
        job.attempts += 1;
        job.nextAttemptAt = new Date(Date.now() + Math.min(3_600_000, 5000 * 2 ** Math.min(job.attempts, 10)));
        this.logger.warn(`Reintento de notificación Mercado Pago: ${job.topic}, intento ${job.attempts}.`);
      }
      await manager.save(job);
    });
  }

  private async request<T>(path: string): Promise<T> {
    const token = env.mercadoPagoTest?.token;
    if (!token) {
      throw new ServiceUnavailableException('Falta la credencial de Mercado Pago.');
    }
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new BadGatewayException('No se pudo consultar el recurso de Mercado Pago.');
    }
    return await response.json() as T;
  }

  private async processResource(manager: EntityManager, job: BillingWebhookJob): Promise<void> {
    if (job.topic === 'subscription_authorized_payment') {
      const invoice = await this.request<{ payment?: { id?: number } }>(`/authorized_payments/${job.resourceId}`);
      if (invoice.payment?.id) {
        await this.processPayment(manager, String(invoice.payment.id));
      }
      return;
    }
    if (job.topic === 'payment') {
      await this.processPayment(manager, job.resourceId);
      return;
    }
    const subscription = await this.request<ProviderSubscription>(`/preapproval/${job.resourceId}`);
    const user = await this.lockOwner(manager, subscription.external_reference, subscription.id);
    if (!user) {
      return;
    }
    // Se relee después del bloqueo para que una notificación atrasada no restaure un estado anterior.
    const current = await this.request<ProviderSubscription>(`/preapproval/${job.resourceId}`);
    this.verifySubscription(current, user, job.resourceId);
    await manager.update(User, { id: user.id }, { mpSubscriptionStatus: current.status });
  }

  private async lockOwner(manager: EntityManager, userId: string, subscriptionId: string): Promise<User | null> {
    if (!/^[a-f0-9-]{36}$/i.test(userId ?? '') || !/^[a-f0-9]{32}$/i.test(subscriptionId ?? '')) {
      return null;
    }
    const payer = env.mercadoPagoTest?.payer;
    if (!payer) {
      throw new ServiceUnavailableException('Falta la cuenta compradora de prueba.');
    }
    const user = await manager.findOne(User, {
      where: { id: userId, email: payer },
      select: { id: true, mpTestCheckoutUrl: true },
      lock: { mode: 'for_no_key_update' },
    });
    const savedId = user?.mpTestCheckoutUrl
      ? new URL(user.mpTestCheckoutUrl).searchParams.get('preapproval_id') : null;
    return savedId === subscriptionId ? user : null;
  }

  private verifySubscription(subscription: ProviderSubscription, user: User, id: string): void {
    const recurring = subscription.auto_recurring;
    if (subscription.id !== id || subscription.external_reference !== user.id ||
        String(subscription.collector_id) !== env.mercadoPagoWebhook.collectorId ||
        !['pending', 'authorized', 'paused', 'cancelled', 'canceled'].includes(subscription.status) ||
        recurring?.currency_id !== 'ARS' || recurring.frequency !== 1 || recurring.frequency_type !== 'months' ||
        recurring.transaction_amount !== env.mercadoPagoTest?.amount) {
      throw new Error('La suscripción no corresponde a la oferta y vendedor configurados.');
    }
  }

  private async processPayment(manager: EntityManager, paymentId: string): Promise<void> {
    if (!/^\d+$/.test(paymentId)) {
      throw new Error('Identificador de pago inválido.');
    }
    const initial = await this.request<ProviderPayment>(`/v1/payments/${paymentId}`);
    if (initial.external_reference?.startsWith('velora-pro:')) {
      await this.purchases.processPayment(manager, paymentId);
      return;
    }
    const subscriptionId = initial.point_of_interaction?.transaction_data?.subscription_id;
    if (!subscriptionId) {
      return;
    }
    const user = await this.lockOwner(manager, initial.external_reference, subscriptionId);
    if (!user) {
      return;
    }
    const payment = await this.request<ProviderPayment>(`/v1/payments/${paymentId}`);
    const subscription = await this.request<ProviderSubscription>(`/preapproval/${subscriptionId}`);
    this.verifySubscription(subscription, user, subscriptionId);
    if (String(payment.id) !== paymentId || payment.external_reference !== user.id ||
        payment.point_of_interaction?.transaction_data?.subscription_id !== subscriptionId ||
        String(payment.collector_id) !== env.mercadoPagoWebhook.collectorId ||
        payment.currency_id !== 'ARS' || payment.transaction_amount !== subscription.auto_recurring.transaction_amount) {
      throw new Error('El pago no corresponde a la suscripción registrada.');
    }

    const approved = payment.status === 'approved' && (payment.transaction_amount_refunded ?? 0) === 0;
    const validUntil = approved && payment.date_approved ? paidMonthUntil(payment.date_approved) : null;
    if (approved && !validUntil) {
      throw new Error('Falta la fecha de aprobación del pago.');
    }
    await manager.upsert(SubscriptionPayment, {
      id: paymentId,
      userId: user.id,
      subscriptionId,
      status: validUntil ? 'approved' : 'inactive',
      validUntil,
    }, ['id']);
    const latest = await manager.findOne(SubscriptionPayment, {
      where: { userId: user.id, status: 'approved' },
      order: { validUntil: 'DESC' },
    });
    await manager.update(User, { id: user.id }, {
      mpProUntil: latest?.validUntil ?? null,
      mpSubscriptionStatus: subscription.status,
    });
  }
}
