import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { CommunityService } from './community.service.js';
import { ContactMailService } from './contact-mail.service.js';
import type { ContactRequest } from './contact-request.entity.js';
vi.mock('../../core/config/env.js', () => ({
  env: { community: { contactEnabled: true } },
}));
const contacts = { count: vi.fn(), create: vi.fn(), save: vi.fn() };
const mail = { available: vi.fn(), notify: vi.fn() };
const dto = {
  name: 'Persona',
  email: 'person@example.com',
  subject: 'consulta',
  message: 'Necesito ayuda con un presupuesto',
  privacyAccepted: true,
};
let service: CommunityService;
beforeEach(() => {
  vi.resetAllMocks();
  mail.available.mockReturnValue(true);
  contacts.count.mockResolvedValue(0);
  contacts.create.mockImplementation((value) => value);
  contacts.save.mockImplementation(async (value) => ({
    ...value,
    id: 'saved-reference',
  }));
  service = new CommunityService(
    contacts as unknown as Repository<ContactRequest>,
    mail as unknown as ContactMailService,
  );
});
describe('Entrega del formulario', () => {
  it('conserva la consulta si falla el correo y no afirma haber notificado', async () => {
    mail.notify.mockResolvedValue(false);
    const result = await service.contact(dto);
    expect(contacts.save).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'saved-reference',
      notificationSent: false,
    });
    expect(result.message).toContain('no pudimos notificar');
  });
  it('no envía correo si la persistencia falla', async () => {
    contacts.save.mockRejectedValue(new Error('database unavailable'));
    await expect(service.contact(dto)).rejects.toThrow('database unavailable');
    expect(mail.notify).not.toHaveBeenCalled();
  });
  it('rechaza el envío antes de guardar cuando falta configurar el proveedor', async () => {
    mail.available.mockReturnValue(false);
    await expect(service.contact(dto)).rejects.toMatchObject({ status: 503 });
    expect(contacts.save).not.toHaveBeenCalled();
  });
  it('notifica solo después de guardar y devuelve referencia', async () => {
    mail.notify.mockImplementation(async (value) => {
      expect(contacts.save).toHaveBeenCalled();
      expect(value.id).toBe('saved-reference');
      return true;
    });
    expect(await service.contact(dto)).toMatchObject({
      notificationSent: true,
      id: 'saved-reference',
    });
  });
});
