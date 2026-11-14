import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
