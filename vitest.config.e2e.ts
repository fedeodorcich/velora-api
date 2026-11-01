import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Pruebas e2e contra PostgreSQL real.
 *
 * - `setupFiles` define el entorno (base `devcrm_test`) antes de importar `AppModule`.
 * - Sin paralelismo entre archivos: todos comparten la misma base de datos y
 *   cada archivo la vacía al empezar.
 * - Requiere `npm run build` previo: las migraciones se leen de `dist/migrations`.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-e2e.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
