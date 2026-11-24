import * as os from 'node:os';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { SessionGuard } from './auth/session.guard';
import { HealthController } from './common/health.controller';
import { loadEnv } from './config/env';
import { typeOrmOptions } from './database/typeorm-options';
import { PlanDoc, PlanSchema } from './plans/plan.schema';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const env = loadEnv();
        return {
          ...typeOrmOptions(env.DATABASE_URL),
          migrationsRun: env.NODE_ENV === 'test',
        };
      },
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: loadEnv().MONGO_URL,
        // Le pilote charge `os` par import() dynamique, indisponible sous Jest : on le fournit.
        runtimeAdapters: { os },
      }),
    }),
    MongooseModule.forFeature([{ name: PlanDoc.name, schema: PlanSchema }]),
    // Aucune limite par défaut : seules les routes avec @Throttle sont limitées.
    ThrottlerModule.forRoot({
      errorMessage: 'Trop de tentatives. Réessayez dans une minute.',
      throttlers: [
        { name: 'default', ttl: 60_000, limit: Number.MAX_SAFE_INTEGER },
      ],
    }),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
