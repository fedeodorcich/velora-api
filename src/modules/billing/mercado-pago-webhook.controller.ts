import { Body, Controller, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { MercadoPagoWebhookDto } from './dto/mercado-pago-webhook.dto.js';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service.js';

@Controller('billing/mercado-pago')
export class MercadoPagoWebhookController {
  constructor(private readonly webhooks: MercadoPagoWebhookService) {}

  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Body() body: MercadoPagoWebhookDto,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Query('data.id') queryId?: string,
  ): Promise<{ received: true }> {
    await this.webhooks.receive(body.type, body.data.id, queryId, signature, requestId);
    return { received: true };
  }
}
