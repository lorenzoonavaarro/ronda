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

function allowedOrigins(webOrigin: string | undefined): string[] {
  const configured = (webOrigin ?? 'http://localhost:3001')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const origins = new Set(configured);

  for (const origin of configured) {
    if (origin.startsWith('http://127.0.0.1:')) {
      origins.add(origin.replace('http://127.0.0.1:', 'http://localhost:'));
    }

    if (origin.startsWith('http://localhost:')) {
      origins.add(origin.replace('http://localhost:', 'http://127.0.0.1:'));
    }
  }

  return [...origins];
}

async function bootstrap() {
  loadLocalEnv();
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: allowedOrigins(process.env.WEB_ORIGIN),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Ronda API listening at http://localhost:${port}`);
}

void bootstrap();
