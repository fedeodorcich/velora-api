import '../config/load-env.js';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './typeorm.config.js';

/**
 * DataSource expuesto para la CLI de TypeORM (migraciones).
 * Uso: `npx typeorm-ts-node-esm migration:generate src/migrations/Nombre -d src/core/database/data-source.ts`
 */
export default new DataSource(dataSourceOptions);
