import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { Connection } from 'mongoose';
import type { DataSource } from 'typeorm';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { loadEnv } from '../../src/config/env';
import { configureApp } from '../../src/configure-app';

export type SentMail = { to: string; subject: string; text: string };

/** Courriers « envoyés » pendant les tests (alimenté par Task 5). */
export const outbox: SentMail[] = [];

/**
 * Point d'extension : Task 4 y remettra à zéro le stockage du throttler
 * (limitation de débit) pour que les tests ne se polluent pas entre eux.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function resetThrottler(_app: INestApplication): Promise<void> {
  return Promise.resolve();
}

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

  const ds = app.get<DataSource>(getDataSourceToken());
  const mongo = app.get<Connection>(getConnectionToken());
  // Les index uniques doivent exister avant que les tests ne s'y fient.
  await Promise.all(Object.values(mongo.models).map((m) => m.syncIndexes()));

  return {
    app,
    http: request(app.getHttpServer() as App),
    /** Remet tout à zéro entre deux tests : tables (hors `migrations`), documents Mongo, courrier. */
    async reset() {
      const tables = await ds.query<{ tablename: string }[]>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'`,
      );
      if (tables.length > 0) {
        const names = tables
          .map((t) => `"public"."${t.tablename.replace(/"/g, '""')}"`)
          .join(', ');
        await ds.query(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
      }
      const collections = await mongo.db!.collections();
      await Promise.all(collections.map((c) => c.deleteMany({})));
      outbox.length = 0;
      await resetThrottler(app);
    },
    outbox,
  };
}
