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
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { UpdateQuoteDto } from './dto/update-quote.dto.js';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto.js';
import { Quote } from './entities/quote.entity.js';
import { QuotesService, QuoteWithItems } from './quotes.service.js';

@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<Quote[]> {
    return this.quotesService.findAll(user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteWithItems> {
    return this.quotesService.findOne(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuoteDto,
  ): Promise<QuoteWithItems> {
    return this.quotesService.create(user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteStatusDto,
  ): Promise<QuoteWithItems> {
    return this.quotesService.updateStatus(user.id, id, dto.status);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
  ): Promise<QuoteWithItems> {
    return this.quotesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.quotesService.remove(user.id, id);
  }
}
