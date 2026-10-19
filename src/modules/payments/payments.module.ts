import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/entities/project.entity.js';
import { Payment } from './entities/payment.entity.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Project])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
