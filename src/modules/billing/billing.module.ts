import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { MercadoPagoPurchaseService } from './mercado-pago-purchase.service.js';
import { BillingController } from './billing.controller.js';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service.js';
import { MercadoPagoWebhookController } from './mercado-pago-webhook.controller.js';
import { BillingService } from './billing.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [BillingController, MercadoPagoWebhookController],
  providers: [BillingService, MercadoPagoWebhookService, MercadoPagoPurchaseService],
})
export class BillingModule {}
