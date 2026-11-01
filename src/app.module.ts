import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { env } from './core/config/env.js';
import { dataSourceOptions } from './core/database/typeorm.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { QuotesModule } from './modules/quotes/quotes.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
// Módulo de seed para desarrollo (endpoint /api/dev/seed).
import { DevModule } from './modules/dev/dev.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      // La app aplica las migraciones pendientes al arrancar.
      migrationsRun: env.database.migrationsRun,
    }),
    AuthModule,
    ClientsModule,
    QuotesModule,
    ProjectsModule,
    PaymentsModule,
    DashboardModule,
    DevModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
