import {
  Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Post, Put, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-user.interface.js';
import { BillingService } from './billing.service.js';
import { UpdateQuoteLogoDto } from './dto/update-quote-logo.dto.js';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.getPlan(user.id);
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
