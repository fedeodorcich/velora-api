import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

/**
 * Configuración global de la aplicación HTTP compartida por `main.ts` y las
 * pruebas e2e. Evita que el prefijo `/api` y la validación de DTOs se
 * desincronicen entre el servidor real y los tests.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
