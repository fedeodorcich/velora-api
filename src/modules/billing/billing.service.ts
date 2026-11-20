import { BadGatewayException, BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { FREE_ACTIVE_CLIENT_LIMIT, hasProAccess, proAccessUntil } from '../../core/billing/plan.js';
import { env } from '../../core/config/env.js';
import { User } from '../users/entities/user.entity.js';
import { MAX_QUOTE_LOGO_BYTES } from './dto/update-quote-logo.dto.js';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async getPlan(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, proUntil: true, mpProUntil: true, proRequestedAt: true, quoteLogo: true },
    });
    if (!user) {
      throw new NotFoundException('La cuenta no existe.');
    }

    const isPro = hasProAccess(user.proUntil, user.mpProUntil);
    return {
      plan: isPro ? 'pro' as const : 'free' as const,
      proUntil: isPro ? proAccessUntil(user.proUntil, user.mpProUntil) : null,
      quoteLogo: isPro ? user.quoteLogo : null,
      interestRegistered: user.proRequestedAt !== null,
      checkout: isPro ? null : env.billing.checkout,
      activeClientLimit: isPro ? null : FREE_ACTIVE_CLIENT_LIMIT,
    };
  }

  mercadoPagoTestPrice(email: string): number | null {
    const config = env.mercadoPagoTest;
    return config?.payer === email ? config.amount : null;
  }

  async getMercadoPagoTestSubscription(userId: string, email: string) {
    const config = env.mercadoPagoTest;
    if (!config || config.payer !== email) {
      throw new ForbiddenException('La consulta de prueba no está disponible para esta cuenta.');
    }
    const user = await this.users.findOne({
      where: { id: userId, email },
      select: { id: true, mpTestCheckoutUrl: true },
    });
    if (!user) {
      throw new NotFoundException('La cuenta no existe.');
    }
    if (!user.mpTestCheckoutUrl) {
      return null;
    }

    try {
      const url = new URL(user.mpTestCheckoutUrl);
      const id = url.searchParams.get('preapproval_id');
      if (!id || !/^[a-f0-9]{32}$/i.test(id)) {
        throw new Error('Identificador de suscripción inválido.');
      }
      const response = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
        headers: { Authorization: `Bearer ${config.token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        throw new Error('Consulta rechazada.');
      }
      const data = await response.json() as {
        id?: string;
        external_reference?: string;
        status?: string;
        auto_recurring?: { transaction_amount?: number; currency_id?: string };
        summarized?: { charged_quantity?: number | null };
      };
      if (data.id !== id || data.external_reference !== userId ||
          !data.status || !['pending', 'authorized', 'paused', 'cancelled', 'canceled'].includes(data.status) ||
          !Number.isFinite(data.auto_recurring?.transaction_amount) ||
          data.auto_recurring?.currency_id !== 'ARS') {
        throw new Error('Respuesta de suscripción inesperada.');
      }

      return {
        status: data.status as 'pending' | 'authorized' | 'paused' | 'cancelled' | 'canceled',
        amount: data.auto_recurring.transaction_amount!,
        currency: 'ARS',
        chargedQuantity: data.summarized?.charged_quantity ?? 0,
      };
    } catch {
      throw new BadGatewayException('No pudimos consultar el estado de tu suscripción en Mercado Pago. Volvé a intentarlo.');
    }
  }

  async createMercadoPagoTestCheckout(userId: string, email: string): Promise<{ url: string }> {
    const config = env.mercadoPagoTest;
    if (!config || config.payer !== email) {
      throw new ForbiddenException('El checkout de prueba no está disponible para esta cuenta.');
    }

    return this.users.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId, email },
        select: { id: true, mpTestCheckoutUrl: true },
        lock: { mode: 'for_no_key_update' },
      });
      if (!user) {
        throw new NotFoundException('La cuenta no existe.');
      }
      if (user.mpTestCheckoutUrl) {
        return { url: user.mpTestCheckoutUrl };
      }

      let url: URL;
      try {
        const response = await fetch('https://api.mercadopago.com/preapproval', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'VeloraCRM Pro (prueba)',
            external_reference: user.id,
            payer_email: email,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              transaction_amount: config.amount,
              currency_id: 'ARS',
            },
            back_url: config.backUrl,
            status: 'pending',
          }),
        });
        if (!response.ok) {
          throw new Error('Mercado Pago rechazó la solicitud.');
        }
        const data = await response.json() as { init_point?: string };
        url = new URL(data.init_point ?? '');
        if (url.origin !== 'https://www.mercadopago.com.ar' ||
            url.pathname !== '/subscriptions/checkout') {
          throw new Error('Enlace de checkout inesperado.');
        }
      } catch {
        throw new BadGatewayException('No pudimos generar el enlace de prueba con Mercado Pago.');
      }

      await manager.update(User, { id: userId }, { mpTestCheckoutUrl: url.href });
      return { url: url.href };
    });
  }

  async registerInterest(userId: string): Promise<void> {
    await this.users.update({ id: userId, proRequestedAt: IsNull() }, { proRequestedAt: new Date() });
  }

  async updateQuoteLogo(userId: string, dataUrl: string): Promise<void> {
    const [header, encoded] = dataUrl.split(',');
    const bytes = Buffer.from(encoded, 'base64');
    const signature = header === 'data:image/png;base64'
      ? Buffer.from('89504e470d0a1a0a', 'hex')
      : Buffer.from('ffd8ff', 'hex');

    if (
      bytes.length > MAX_QUOTE_LOGO_BYTES ||
      bytes.toString('base64') !== encoded ||
      !bytes.subarray(0, signature.length).equals(signature)
    ) {
      throw new BadRequestException('Subí un logo PNG o JPEG válido de hasta 64 KiB.');
    }

    const result = await this.users.update(
      [
        { id: userId, proUntil: MoreThan(new Date()) },
        { id: userId, mpProUntil: MoreThan(new Date()) },
      ],
      { quoteLogo: dataUrl },
    );
    if (!result.affected) {
      throw new ForbiddenException('Necesitás una suscripción Pro activa para subir un logo.');
    }
  }

  async removeQuoteLogo(userId: string): Promise<void> {
    await this.users.update({ id: userId }, { quoteLogo: null });
  }
}
