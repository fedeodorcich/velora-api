import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../users/entities/user.entity.js';
import { BillingService } from './billing.service.js';

vi.mock('../../core/config/env.js', () => ({
  env: {
    mercadoPagoTest: {
      token: 'test-token',
      payer: 'buyer@testuser.com',
      amount: 2500,
      backUrl: 'https://example.com/plan',
    },
    billing: { checkout: null },
  },
}));

const id = 'a309951b87244621b1d10cd1231614dd';
const users = { findOne: vi.fn(), update: vi.fn() };
const service = new BillingService(users as unknown as Repository<User>);
const request = vi.fn();

describe('Consulta de suscripción de prueba', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', request);
    users.findOne.mockResolvedValue({
      id: 'owner',
      mpTestCheckoutUrl: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${id}`,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consulta únicamente la suscripción guardada del usuario y conserva el acceso actual', async () => {
    request.mockResolvedValue({
      ok: true,
      json: async () => ({
        id,
        external_reference: 'owner',
        status: 'pending',
        auto_recurring: { transaction_amount: 2500, currency_id: 'ARS' },
        summarized: { charged_quantity: null },
      }),
    });

    await expect(service.getMercadoPagoTestSubscription('owner', 'buyer@testuser.com')).resolves.toEqual({
      status: 'pending', amount: 2500, currency: 'ARS', chargedQuantity: 0,
    });
    expect(users.findOne).toHaveBeenCalledWith({
      where: { id: 'owner', email: 'buyer@testuser.com' },
      select: { id: true, mpTestCheckoutUrl: true },
    });
    expect(request).toHaveBeenCalledWith(
      `https://api.mercadopago.com/preapproval/${id}`,
      expect.objectContaining({ redirect: 'error' }),
    );
    expect(users.update).not.toHaveBeenCalled();
  });

  it('rechaza la cuenta que no está habilitada para probar', async () => {
    await expect(service.getMercadoPagoTestSubscription('other', 'other@example.com'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(request).not.toHaveBeenCalled();
  });

  it('rechaza una respuesta que corresponde a otra cuenta', async () => {
    request.mockResolvedValue({
      ok: true,
      json: async () => ({
        id, external_reference: 'other', status: 'authorized',
        auto_recurring: { transaction_amount: 2500, currency_id: 'ARS' },
      }),
    });
    await expect(service.getMercadoPagoTestSubscription('owner', 'buyer@testuser.com'))
      .rejects.toBeInstanceOf(BadGatewayException);
    expect(users.update).not.toHaveBeenCalled();
  });

  it('devuelve ausencia de suscripción sin llamar al proveedor', async () => {
    users.findOne.mockResolvedValue({ id: 'owner', mpTestCheckoutUrl: null });
    await expect(service.getMercadoPagoTestSubscription('owner', 'buyer@testuser.com')).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
