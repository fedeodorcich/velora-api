import type { DataSourceOptions } from 'typeorm';
import { env } from '../config/env.js';
import { User } from '../../modules/users/entities/user.entity.js';
import { Client } from '../../modules/clients/entities/client.entity.js';
import { Quote } from '../../modules/quotes/entities/quote.entity.js';
import { QuoteItem } from '../../modules/quotes/entities/quote-item.entity.js';
import { Project } from '../../modules/projects/entities/project.entity.js';
import { Payment } from '../../modules/payments/entities/payment.entity.js';

/**
 * Opciones de conexión compartidas por la app (TypeOrmModule) y por la CLI de migraciones.
 * `migrationsRun` NO se incluye aquí: solo la app lo activa, la CLI aplica migraciones de forma explícita.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: env.database.host,
  port: env.database.port,
  username: env.database.username,
  password: env.database.password,
  database: env.database.name,
  ssl: env.database.ssl ? { rejectUnauthorized: false } : false,
  entities: [User, Client, Quote, QuoteItem, Project, Payment],
  migrations: ['dist/migrations/*.js'],
  synchronize: env.database.synchronize,
  logging: false,
};
