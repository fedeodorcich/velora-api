import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { DataSource, EntityManager, MoreThan } from 'typeorm';
import { proAccessUntil } from '../../core/billing/plan.js';
import { paidMonthUntil } from '../../core/billing/paid-month.js';
import { env } from '../../core/config/env.js';
import { User } from '../users/entities/user.entity.js';
import { ProPurchase } from './entities/pro-purchase.entity.js';
import { SubscriptionPayment } from './entities/subscription-payment.entity.js';

@Injectable()
export class MercadoPagoPurchaseService {
  constructor(private readonly db: DataSource) {}

  offer(email: string) {
    const config = env.mercadoPagoTest;
    return env.billing.membershipsEnabled && env.mercadoPagoOneTimeEnabled &&
      config?.payer === email &&
      env.mercadoPagoWebhook.secret &&
      env.mercadoPagoWebhook.collectorId
      ? { amount: config.amount, currency: 'ARS', months: 1, test: true }
      : null;
  }

  private client(): MercadoPagoConfig {
    const config = env.mercadoPagoTest;
    if (!config) throw new ForbiddenException('El pago no está disponible.');
    return new MercadoPagoConfig({
      accessToken: config.token,
      options: { timeout: 8000, maxRetries: 0 },
    });
  }

  async createCheckout(userId: string, email: string) {
    const offer = this.offer(email);
    if (!offer)
      throw new ForbiddenException(
        'El pago único de prueba no está disponible para esta cuenta.',
      );
    return this.db.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId, email },
        lock: { mode: 'for_no_key_update' },
      });
      if (!user) throw new NotFoundException('La cuenta no existe.');
      const existing = await manager.findOne(ProPurchase, {
        where: {
          userId,
          status: 'pending',
          amount: offer.amount,
          currency: offer.currency,
          expiresAt: MoreThan(new Date()),
        },
        select: { id: true, checkoutUrl: true },
        order: { createdAt: 'DESC' },
      });
      if (existing?.checkoutUrl)
        return { id: existing.id, url: existing.checkoutUrl };
      const purchase = await manager.save(
        manager.create(ProPurchase, {
          userId,
          amount: offer.amount,
          currency: offer.currency,
          expiresAt: new Date(Date.now() + 24 * 3600_000),
          preferenceId: null,
          checkoutUrl: null,
          grantedUntil: null,
        }),
      );
      const config = env.mercadoPagoTest!;
      const backUrl = new URL(config.backUrl);
      backUrl.searchParams.set('purchase', purchase.id);
      const publicAppUrl =
        backUrl.protocol === 'https:' &&
        !['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(
          backUrl.hostname,
        );
      try {
        const result = await new Preference(this.client()).create({
          body: {
            items: [
              {
                id: 'velora-pro-month',
                title: 'Bakrivo Pro · 1 mes sin renovación automática',
                quantity: 1,
                unit_price: purchase.amount,
                currency_id: purchase.currency,
              },
            ],
            payer: { email },
            external_reference: `velora-pro:${purchase.id}`,
            back_urls: {
              success: backUrl.href,
              failure: backUrl.href,
              pending: backUrl.href,
            },
            ...(publicAppUrl ? { auto_return: 'approved' } : {}),
            expires: true,
            expiration_date_to: purchase.expiresAt.toISOString(),
          },
          requestOptions: { idempotencyKey: purchase.id },
        });
        const checkout = new URL(result.init_point ?? '');
        if (
          !result.id ||
          checkout.origin !== 'https://www.mercadopago.com.ar' ||
          checkout.pathname !== '/checkout/v1/redirect' ||
          checkout.username ||
          checkout.password
        ) {
          throw new Error('Respuesta de checkout inválida.');
        }
        purchase.preferenceId = result.id;
        purchase.checkoutUrl = checkout.href;
        await manager.save(purchase);
        return { id: purchase.id, url: checkout.href };
      } catch {
        throw new BadGatewayException(
          'No pudimos abrir Mercado Pago. Volvé a intentarlo; no se activó ningún cobro automático.',
        );
      }
    });
  }

  async latest(userId: string) {
    const purchase = await this.db
      .getRepository(ProPurchase)
      .findOne({ where: { userId }, order: { createdAt: 'DESC', id: 'DESC' } });
    return purchase ? this.summary(purchase) : null;
  }

  async refresh(userId: string, id: string, paymentId?: string) {
    const purchase = await this.db
      .getRepository(ProPurchase)
      .findOne({ where: { id, userId } });
    if (!purchase) throw new NotFoundException('Compra no encontrada.');
    if (paymentId) {
      await this.db.transaction((manager) =>
        this.processPayment(manager, paymentId, purchase.id),
      );
    }
    const updated = await this.db
      .getRepository(ProPurchase)
      .findOneOrFail({ where: { id, userId } });
    return this.summary(updated);
  }

  private summary(purchase: ProPurchase) {
    return {
      id: purchase.id,
      amount: purchase.amount,
      currency: purchase.currency,
      status:
        purchase.status === 'pending' && purchase.expiresAt < new Date()
          ? 'expired'
          : purchase.status,
      validUntil: purchase.status === 'approved' ? purchase.grantedUntil : null,
    };
  }

  private async getPayment(id: string) {
    try {
      return await new Payment(this.client()).get({ id });
    } catch {
      throw new BadGatewayException(
        'No pudimos consultar el pago en Mercado Pago. Volvé a intentarlo en unos instantes.',
      );
    }
  }

  async processPayment(
    manager: EntityManager,
    paymentId: string,
    expectedPurchaseId?: string,
  ): Promise<void> {
    const payment = await this.getPayment(paymentId);
    const reference = payment.external_reference ?? '';
    if (!/^velora-pro:[a-f0-9-]{36}$/i.test(reference))
      throw new Error('El pago no corresponde a una compra Pro.');
    const purchaseId = reference.slice('velora-pro:'.length);
    if (expectedPurchaseId && purchaseId !== expectedPurchaseId)
      throw new ForbiddenException('El pago no corresponde a esta compra.');
    const purchase = await manager.findOne(ProPurchase, {
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException('Compra no encontrada.');
    const user = await manager.findOne(User, {
      where: { id: purchase.userId, email: env.mercadoPagoTest!.payer },
      select: { id: true, proUntil: true, mpProUntil: true },
      lock: { mode: 'for_no_key_update' },
    });
    if (!user) throw new NotFoundException('La cuenta de la compra no existe.');
    const lockedPurchase = await manager.findOneOrFail(ProPurchase, {
      where: { id: purchaseId, userId: user.id },
      lock: { mode: 'pessimistic_write' },
    });
    // Releer tras bloquear la cuenta impide que un aviso atrasado restaure un estado anterior.
    const current = await new Payment(this.client()).get({ id: paymentId });
    if (
      String(current.id) !== paymentId ||
      current.external_reference !== reference ||
      String(current.collector_id) !== env.mercadoPagoWebhook.collectorId ||
      current.currency_id !== lockedPurchase.currency ||
      current.transaction_amount !== lockedPurchase.amount
    ) {
      throw new ForbiddenException(
        'El pago no corresponde al importe y vendedor de esta compra.',
      );
    }
    const approved =
      current.status === 'approved' &&
      (current.transaction_amount_refunded ?? 0) === 0;
    if (approved && !lockedPurchase.grantedUntil) {
      const approvedAt = new Date(current.date_approved ?? '');
      if (!Number.isFinite(approvedAt.getTime()))
        throw new Error('Falta la fecha de aprobación.');
      const existingUntil = proAccessUntil(user.proUntil, user.mpProUntil);
      lockedPurchase.grantedUntil = paidMonthUntil(
        new Date(
          Math.max(approvedAt.getTime(), existingUntil?.getTime() ?? 0),
        ).toISOString(),
      );
    }
    const ledgerKey = `purchase:${purchaseId}`;
    const prior = await manager.findOne(SubscriptionPayment, {
      where: { id: paymentId },
    });
    if (
      prior &&
      (prior.userId !== user.id || prior.subscriptionId !== ledgerKey)
    )
      throw new ForbiddenException('El pago ya pertenece a otra operación.');
    await manager.upsert(
      SubscriptionPayment,
      {
        id: paymentId,
        userId: user.id,
        subscriptionId: ledgerKey,
        status: approved ? 'approved' : 'inactive',
        validUntil: approved ? lockedPurchase.grantedUntil : null,
      },
      ['id'],
    );
    const paid = await manager.count(SubscriptionPayment, {
      where: { userId: user.id, subscriptionId: ledgerKey, status: 'approved' },
    });
    lockedPurchase.status =
      paid > 0
        ? 'approved'
        : lockedPurchase.grantedUntil ||
            current.status === 'refunded' ||
            current.status === 'charged_back' ||
            (current.transaction_amount_refunded ?? 0) > 0
          ? 'refunded'
          : current.status === 'rejected' || current.status === 'cancelled'
            ? 'rejected'
            : 'pending';
    await manager.save(lockedPurchase);
    const latest = await manager.findOne(SubscriptionPayment, {
      where: { userId: user.id, status: 'approved' },
      order: { validUntil: 'DESC' },
    });
    await manager.update(
      User,
      { id: user.id },
      { mpProUntil: latest?.validUntil ?? null },
    );
  }
}
