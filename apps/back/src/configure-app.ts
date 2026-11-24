import type { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { type NextFunction, type Request, type Response, json } from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { AllExceptionsFilter, respondWithError } from './common/error.filter';
import type { Env } from './config/env';

/** À utiliser avec NestFactory.create(AppModule, { bodyParser: false }). */
export function configureApp(app: INestApplication, env: Env): void {
  z.config(z.locales.fr()); // messages de validation en français
  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: '1mb' }));
  // Les erreurs du parseur de corps naissent avant le routeur Nest : ses filtres ne les voient pas.
  app.use(bodyParserErrors);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: env.FRONT_ORIGIN, credentials: true });
  app.setGlobalPrefix('api');
}

function bodyParserErrors(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err === undefined || err === null) next();
  else respondWithError(err, res);
}
