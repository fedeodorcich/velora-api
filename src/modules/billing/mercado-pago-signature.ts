import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

export function verifyMercadoPagoSignature(
  secret: string,
  dataId: string,
  signature: string | undefined,
  requestId: string | undefined,
): void {
  const parts = signature?.split(',').map((part) => part.trim().split('='));
  const ts = parts?.filter(([key]) => key === 'ts');
  const hashes = parts?.filter(([key]) => key === 'v1');
  if (!requestId || requestId.length > 200 || /[;\r\n]/.test(requestId) ||
      ts?.length !== 1 || hashes?.length !== 1 ||
      !/^\d{1,16}$/.test(ts[0][1] ?? '') || !/^[a-f0-9]{64}$/i.test(hashes[0][1] ?? '')) {
    throw new UnauthorizedException('La firma de Mercado Pago no es válida.');
  }
  const canonical = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts[0][1]};`;
  const expected = createHmac('sha256', secret).update(canonical).digest();
  if (!timingSafeEqual(expected, Buffer.from(hashes[0][1], 'hex'))) {
    throw new UnauthorizedException('La firma de Mercado Pago no es válida.');
  }
}
