import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    // Solo unitarios: los e2e viven en `test/` y tienen su propia configuración.
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**', 'test/**'],
  },
});
