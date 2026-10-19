import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-user.interface.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentDto } from './dto/update-payment.dto.js';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto.js';
import { Payment } from './entities/payment.entity.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<Payment[]> {
    return this.paymentsService.findAll(user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Payment> {
    return this.paymentsService.findOne(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
  ): Promise<Payment> {
    return this.paymentsService.create(user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ): Promise<Payment> {
    return this.paymentsService.updateStatus(user.id, id, dto.status);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
  ): Promise<Payment> {
    return this.paymentsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.paymentsService.remove(user.id, id);
  }
}
