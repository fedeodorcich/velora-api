import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule } from '../clients/clients.module.js';
import { QuoteItem } from './entities/quote-item.entity.js';
import { Quote } from './entities/quote.entity.js';
import { QuotesController } from './quotes.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Quote, QuoteItem]), ClientsModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
