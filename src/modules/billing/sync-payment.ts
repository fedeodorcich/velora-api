import dataSource from '../../core/database/data-source.js';
import { env } from '../../core/config/env.js';
import { BillingWebhookJob } from './entities/billing-webhook-job.entity.js';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service.js';

const [paymentId, ...extra] = process.argv.slice(2);
if (!/^\d{1,64}$/.test(paymentId ?? '') || extra.length) {
  throw new Error('Uso: npm run billing:sync-payment -- ID_DEL_PAGO');
}
if (!env.mercadoPagoTest || !env.mercadoPagoWebhook.collectorId) {
  throw new Error('Configurá la credencial de prueba y MP_WEBHOOK_COLLECTOR_ID antes de conciliar.');
}

await dataSource.initialize();
try {
  const id = `payment:${paymentId}`;
  await dataSource.getRepository(BillingWebhookJob).upsert({
    id, topic: 'payment', resourceId: paymentId, pending: true, attempts: 0, nextAttemptAt: new Date(),
  }, ['id']);
  const service = new MercadoPagoWebhookService(dataSource);
  // Procesa la cola pendiente incluyendo el pago solicitado, con un límite operativo.
  for (let index = 0; index < 100; index += 1) {
    const job = await dataSource.getRepository(BillingWebhookJob).findOneByOrFail({ id });
    if (!job.pending) {
      console.log('Conciliación procesada. Consultá Mi plan para verificar la vigencia.');
      break;
    }
    if (job.attempts > 0) {
      throw new Error('La conciliación quedó en reintento. Revisá la configuración y el estado del proveedor.');
    }
    if (index === 99) {
      throw new Error('El pago sigue en cola. Esperá al procesador o volvé a ejecutar el comando.');
    }
    await service.processNext();
  }
} finally {
  await dataSource.destroy();
}
