import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMercadoPagoSignature } from './mercado-pago-signature.js';
import { paidMonthUntil } from './mercado-pago-webhook.service.js';

describe('Firma y períodos de Mercado Pago', () => {
  it('normaliza el identificador al validar la firma', () => {
    const hash = createHmac('sha256', 'secret').update('id:abc123;request-id:request;ts:123;').digest('hex');
    expect(() => verifyMercadoPagoSignature('secret', 'ABC123', `ts=123,v1=${hash}`, 'request')).not.toThrow();
    expect(() => verifyMercadoPagoSignature('secret', 'ABC123', `ts=123,v1=${hash}`, 'other')).toThrow();
  });

  it('rechaza firmas malformadas y claves de firma duplicadas', () => {
    expect(() => verifyMercadoPagoSignature('secret', '123', 'ts=123,v1=invalid', 'request')).toThrow();
    expect(() => verifyMercadoPagoSignature('secret', '123', 'ts=123,ts=456,v1=' + '0'.repeat(64), 'request')).toThrow();
  });

  it('respeta el último día de febrero incluyendo años bisiestos', () => {
    expect(paidMonthUntil('2030-01-31T12:15:00Z').toISOString()).toBe('2030-02-28T12:15:00.000Z');
    expect(paidMonthUntil('2032-01-31T12:15:00Z').toISOString()).toBe('2032-02-29T12:15:00.000Z');
  });
});
