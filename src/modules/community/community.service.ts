import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Preference, MercadoPagoConfig } from 'mercadopago';
import { MoreThan, Repository } from 'typeorm';
import { env } from '../../core/config/env.js';
import { ContactRequest } from './contact-request.entity.js';
import { ContactRequestDto } from './community.dto.js';

@Injectable()
export class CommunityService {
  private readonly requests = new Map<string, number>();
  constructor(
    @InjectRepository(ContactRequest)
    private readonly contacts: Repository<ContactRequest>,
  ) {}

  config() {
    return {
      supportEmail: env.community.supportEmail || null,
      contactEnabled:
        env.community.contactEnabled && Boolean(env.community.supportEmail),
      donationUrl: env.community.donationsEnabled
        ? env.community.donationUrl || null
        : null,
      donationTestEnabled:
        env.community.donationTestEnabled && Boolean(env.mercadoPagoTest),
      donationAmounts: [500, 1000, 2500],
      currency: 'ARS',
    };
  }

  async contact(dto: ContactRequestDto) {
    if (!env.community.contactEnabled || !env.community.supportEmail)
      throw new ServiceUnavailableException(
        'El canal de soporte se está preparando. El envío todavía no está disponible.',
      );
    if (dto.website?.trim())
      throw new ForbiddenException(
        'No pudimos enviar la consulta. Revisá los datos e intentá nuevamente.',
      );
    const name = dto.name.trim(),
      email = dto.email.trim().toLowerCase(),
      message = dto.message.trim();
    if (name.length < 2 || message.length < 10)
      throw new BadRequestException(
        'Completá tu nombre y el detalle de la consulta.',
      );
    const now = Date.now();
    for (const [key, time] of this.requests)
      if (now - time > 60_000) this.requests.delete(key);
    if (this.requests.has(email) || this.requests.size >= 1000)
      throw new HttpException(
        'Esperá un minuto antes de enviar otra consulta.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    this.requests.set(email, now);
    const recent = await this.contacts.count({
      where: { email, createdAt: MoreThan(new Date(now - 3600_000)) },
    });
    if (recent >= 3)
      throw new HttpException(
        'Alcanzaste el límite de consultas de esta hora. Intentá más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const saved = await this.contacts.save(
      this.contacts.create({ name, email, subject: dto.subject, message }),
    );
    return {
      id: saved.id,
      message:
        'Tu consulta quedó registrada. Conservá este número de referencia.',
    };
  }

  async testDonation(email: string, amount: number) {
    const config = env.mercadoPagoTest;
    if (!env.community.donationTestEnabled || !config || email !== config.payer)
      throw new ForbiddenException(
        'El checkout de donaciones de prueba no está disponible para esta cuenta.',
      );
    const backUrl = new URL(config.backUrl);
    backUrl.pathname = '/apoyar';
    backUrl.search = '?retorno=1';
    const publicAppUrl =
      backUrl.protocol === 'https:' &&
      !['localhost', '127.0.0.1', '0.0.0.0'].includes(backUrl.hostname);
    try {
      const result = await new Preference(
        new MercadoPagoConfig({
          accessToken: config.token,
          options: { timeout: 8000, maxRetries: 0 },
        }),
      ).create({
        body: {
          items: [
            {
              id: 'velora-voluntary-donation',
              title: 'Donación voluntaria a VeloraCRM · sin contraprestación',
              quantity: 1,
              unit_price: amount,
              currency_id: 'ARS',
            },
          ],
          payer: { email },
          external_reference: 'velora-donation:' + randomUUID(),
          back_urls: {
            success: backUrl.href,
            failure: backUrl.href,
            pending: backUrl.href,
          },
          ...(publicAppUrl ? { auto_return: 'approved' } : {}),
        },
      });
      const url = new URL(result.init_point ?? '');
      if (
        url.origin !== 'https://www.mercadopago.com.ar' ||
        url.pathname !== '/checkout/v1/redirect' ||
        url.username ||
        url.password
      )
        throw new Error('Enlace inválido');
      // Las donaciones no escriben en el historial de membresías ni conceden acceso.
      return { url: url.href };
    } catch {
      throw new BadGatewayException(
        'No pudimos abrir Mercado Pago. Volvé a intentarlo.',
      );
    }
  }
}
