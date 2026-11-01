import './core/config/load-env.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './core/bootstrap/configure-app.js';
import { env } from './core/config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  configureApp(app);
  app.enableCors({ origin: env.corsOrigins, credentials: true });

  await app.listen(env.port);
}

await bootstrap();
