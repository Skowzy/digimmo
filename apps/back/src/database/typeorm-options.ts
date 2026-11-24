import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { PasswordReset } from '../auth/password-reset.entity';
import { FurnitureItem } from '../catalog/furniture-item.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';

/** Options TypeORM partagées par l'application, le CLI et les tests. `synchronize` reste toujours à false. */
export function typeOrmOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: [User, PasswordReset, Project, FurnitureItem],
    migrations: [
      join(
        __dirname,
        'migrations',
        __filename.endsWith('.ts') ? '*.ts' : '*.js',
      ),
    ],
    migrationsTableName: 'migrations',
    namingStrategy: new SnakeNamingStrategy(),
    // gen_random_uuid() est natif depuis PostgreSQL 13 : pas besoin de uuid-ossp.
    uuidExtension: 'pgcrypto',
    synchronize: false,
  };
}
