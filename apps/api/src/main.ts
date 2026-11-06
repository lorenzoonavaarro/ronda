import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

function loadLocalEnv() {
  for (const file of ['.env', '../../.env']) {
    const path = resolve(process.cwd(), file);

    if (existsSync(path)) {
      process.loadEnvFile(path);
    }
  }
}

async function bootstrap() {
  loadLocalEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
