import type { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { json } from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import type { Env } from './config/env';

/** À utiliser avec NestFactory.create(AppModule, { bodyParser: false }). */
export function configureApp(app: INestApplication, env: Env): void {
  z.config(z.locales.fr()); // messages de validation en français
  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: '1mb' }));
  app.enableCors({ origin: env.FRONT_ORIGIN, credentials: true });
  app.setGlobalPrefix('api');
}
