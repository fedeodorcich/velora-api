import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { FREE_ACTIVE_CLIENT_LIMIT, hasProAccess } from '../../core/billing/plan.js';
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
      select: { id: true, proUntil: true, proRequestedAt: true, quoteLogo: true },
    });
    if (!user) {
      throw new NotFoundException('La cuenta no existe.');
    }

    const isPro = hasProAccess(user.proUntil);
    return {
      plan: isPro ? 'pro' as const : 'free' as const,
      proUntil: isPro ? user.proUntil : null,
      quoteLogo: isPro ? user.quoteLogo : null,
      interestRegistered: user.proRequestedAt !== null,
      checkout: isPro ? null : env.billing.checkout,
      activeClientLimit: isPro ? null : FREE_ACTIVE_CLIENT_LIMIT,
    };
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
      { id: userId, proUntil: MoreThan(new Date()) },
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
