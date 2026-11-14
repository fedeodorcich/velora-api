import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MoreThan, type Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../users/entities/user.entity.js';
import { BillingService } from './billing.service.js';

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+6kAAAAASUVORK5CYII=';
const users = { findOne: vi.fn(), update: vi.fn() };
const service = new BillingService(users as unknown as Repository<User>);

describe('BillingService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('oculta el logo y restablece el cupo al vencer Pro', async () => {
    users.findOne.mockResolvedValue({
      id: 'user-1',
      quoteLogo: LOGO,
      proUntil: new Date(0),
      proRequestedAt: new Date(),
    });

    await expect(service.getPlan('user-1')).resolves.toMatchObject({
      plan: 'free',
      quoteLogo: null,
      proUntil: null,
      activeClientLimit: 5,
      interestRegistered: true,
    });
    expect(users.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-1' } }));
  });

  it('rechaza un archivo que no coincide con el formato declarado', async () => {
    await expect(service.updateQuoteLogo('user-1', 'data:image/png;base64,AAAA'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(users.update).not.toHaveBeenCalled();
  });

  it('condiciona la escritura del logo a una vigencia futura', async () => {
    users.update.mockResolvedValue({ affected: 0 });
    const before = new Date();

    await expect(service.updateQuoteLogo('user-1', LOGO)).rejects.toBeInstanceOf(ForbiddenException);
    const [where, values] = users.update.mock.calls[0];
    expect(where.id).toBe('user-1');
    expect(where.proUntil.type).toBe(MoreThan(before).type);
    expect(where.proUntil.value.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(values).toEqual({ quoteLogo: LOGO });
  });
});
