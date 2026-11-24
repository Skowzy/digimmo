import * as os from 'node:os';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
