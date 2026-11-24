import * as os from 'node:os';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { SessionGuard } from './auth/session.guard';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './common/health.controller';
import { loadEnv } from './config/env';
import { typeOrmOptions } from './database/typeorm-options';
import { ProjectsModule } from './projects/projects.module';

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
    // Le garde n'est posé (@UseGuards(ThrottlerGuard)) que sur les routes avec @Throttle :
    // les autres ne sont ni comptées ni annotées d'en-têtes X-RateLimit.
    ThrottlerModule.forRoot({
      errorMessage: 'Trop de tentatives. Réessayez dans une minute.',
      throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
    }),
    AuthModule,
    CatalogModule,
    ProjectsModule,
  ],
  controllers: [HealthController],
  // L'ordre compte : SessionGuard authentifie, puis RolesGuard vérifie le rôle.
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
