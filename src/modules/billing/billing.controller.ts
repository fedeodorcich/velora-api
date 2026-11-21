import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Header, HttpCode, HttpStatus, Post, Put, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-user.interface.js';
import { env } from '../../core/config/env.js';
import { MercadoPagoPurchaseService } from './mercado-pago-purchase.service.js';
import { RefreshProPurchaseDto } from './dto/refresh-pro-purchase.dto.js';
import { BillingService } from './billing.service.js';
import { UpdateQuoteLogoDto } from './dto/update-quote-logo.dto.js';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService, private readonly purchases: MercadoPagoPurchaseService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async getPlan(@CurrentUser() user: AuthenticatedUser) {
    const plan = await this.billing.getPlan(user.id);
    return {
      ...plan,
      oneTimeOffer: this.purchases.offer(user.email),
      mercadoPagoTestPrice: this.billing.mercadoPagoTestPrice(user.email),
      automaticBilling: Boolean(env.mercadoPagoWebhook.secret && env.mercadoPagoWebhook.collectorId),
    };
  }

  @Get('mercado-pago/test-subscription')
  @Header('Cache-Control', 'no-store')
  getMercadoPagoTestSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.getMercadoPagoTestSubscription(user.id, user.email);
  }

  @Post('mercado-pago/test-checkout')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  createMercadoPagoTestCheckout() {
    return this.billing.createMercadoPagoTestCheckout();
  }

  @Post('mercado-pago/purchases')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  createPurchase(@CurrentUser() user: AuthenticatedUser) {
    return this.purchases.createCheckout(user.id, user.email);
  }

  @Get('mercado-pago/purchases/latest')
  @Header('Cache-Control', 'no-store')
  latestPurchase(@CurrentUser() user: AuthenticatedUser) { return this.purchases.latest(user.id); }

  @Post('mercado-pago/purchases/:id/refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  refreshPurchase(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RefreshProPurchaseDto) {
    return this.purchases.refresh(user.id, id, dto.paymentId);
  }

  @Post('interest')
  @HttpCode(HttpStatus.NO_CONTENT)
  registerInterest(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.billing.registerInterest(user.id);
  }

  @Put('quote-logo')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateQuoteLogo(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuoteLogoDto,
  ): Promise<void> {
    return this.billing.updateQuoteLogo(user.id, dto.dataUrl);
  }

  @Delete('quote-logo')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeQuoteLogo(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.billing.removeQuoteLogo(user.id);
  }
}
