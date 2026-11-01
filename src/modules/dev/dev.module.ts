import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { UsersModule } from '../users/users.module.js';
import { SeedController } from './seed.controller.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [
    ClientsModule,
    QuotesModule,
    ProjectsModule,
    PaymentsModule,
    UsersModule,
    DashboardModule,
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class DevModule {}
