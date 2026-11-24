import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { loadEnv } from '../../src/config/env';
import { configureApp } from '../../src/configure-app';

export type SentMail = { to: string; subject: string; text: string };

/** Courriers « envoyés » pendant les tests (alimenté par Task 5). */
export const outbox: SentMail[] = [];

export async function createTestApp(): Promise<{
  app: INestApplication;
  http: ReturnType<typeof request>;
  reset(): Promise<void>;
  outbox: SentMail[];
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureApp(app, loadEnv());
  await app.init();

  return {
    app,
    http: request(app.getHttpServer() as App),
    // Rempli par Task 3 : vider les tables PostgreSQL (hors migrations) et les collections MongoDB.
    reset() {
      outbox.length = 0;
      return Promise.resolve();
    },
    outbox,
  };
}
