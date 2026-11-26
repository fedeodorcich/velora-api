import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../core/config/env.js';
import type { ContactRequest } from './contact-request.entity.js';

@Injectable()
export class ContactMailService {
  private readonly logger = new Logger(ContactMailService.name);

  available(): boolean {
    return Boolean(
      env.community.supportEmail &&
      env.contactMail.apiKey &&
      env.contactMail.from,
    );
  }

  async notify(contact: ContactRequest): Promise<boolean> {
    if (!this.available()) return false;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: 'Bearer ' + env.contactMail.apiKey,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'contact/' + contact.id,
        },
        body: JSON.stringify({
          from: env.contactMail.from,
          to: [env.community.supportEmail],
          reply_to: contact.email,
          subject: '[Bakrivo] ' + contact.subject + ' · ' + contact.id,
          text: [
            'Nueva consulta de soporte',
            'Referencia: ' + contact.id,
            'Nombre: ' + contact.name,
            'Correo: ' + contact.email,
            'Motivo: ' + contact.subject,
            '',
            contact.message,
          ].join('\n'),
        }),
      });
      if (!response.ok) throw new Error('Proveedor no disponible');
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== 'object' ||
        !('id' in result) ||
        typeof result.id !== 'string' ||
        !result.id
      )
        throw new Error('Respuesta inválida');
      return true;
    } catch {
      // No registrar credenciales, cuerpos del proveedor ni contenido personal.
      this.logger.warn(
        'Consulta guardada sin notificación de correo: ' + contact.id,
      );
      return false;
    }
  }
}
