import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactMailService } from './contact-mail.service.js';
import type { ContactRequest } from './contact-request.entity.js';
const settings = vi.hoisted(() => ({
  apiKey: 'private-test-key',
  from: 'Bakrivo <support@example.com>',
}));
vi.mock('../../core/config/env.js', () => ({
  env: {
    contactMail: settings,
    community: { supportEmail: 'veloracrm.support@gmail.com' },
  },
}));
const contact = {
  id: 'reference-123',
  name: 'Cliente',
  email: 'client@example.com',
  subject: 'consulta',
  message: '<texto sin interpretar>',
} as ContactRequest;
afterEach(() => {
  vi.unstubAllGlobals();
  settings.apiKey = 'private-test-key';
});
describe('ContactMailService', () => {
  it('envía solo a soporte, permite responder al cliente y usa referencia idempotente', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'mail-1' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(await new ContactMailService().notify(contact)).toBe(true);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers).toMatchObject({
      'Idempotency-Key': 'contact/reference-123',
    });
    expect(JSON.parse(options.body as string)).toMatchObject({
      to: ['veloracrm.support@gmail.com'],
      reply_to: 'client@example.com',
      from: settings.from,
      text: expect.stringContaining(contact.message),
    });
  });
  it.each([500, 403, 429])(
    'no afirma envío si el proveedor devuelve %s',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{}', { status })),
      );
      expect(await new ContactMailService().notify(contact)).toBe(false);
    },
  );
  it('maneja cortes de red sin exponer errores del proveedor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret')));
    expect(await new ContactMailService().notify(contact)).toBe(false);
  });
  it('no habilita el envío sin credenciales ni llama al proveedor', async () => {
    settings.apiKey = '';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new ContactMailService();
    expect(service.available()).toBe(false);
    expect(await service.notify(contact)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rechaza una respuesta exitosa sin identificador', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    );
    expect(await new ContactMailService().notify(contact)).toBe(false);
  });
});
