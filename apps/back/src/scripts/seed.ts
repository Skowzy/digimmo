import * as argon2 from 'argon2';
import type { DataSource } from 'typeorm';
import { CATALOG_SEED } from '../catalog/catalog.seed-data';
import { FurnitureItem } from '../catalog/furniture-item.entity';
import { User } from '../users/user.entity';

/** Insère le catalogue s'il est vide. Retourne le nombre d'éléments insérés (0 si déjà rempli). */
export async function seedCatalog(ds: DataSource): Promise<number> {
  const repo = ds.getRepository(FurnitureItem);
  if ((await repo.count()) > 0) return 0;
  await repo.insert(CATALOG_SEED);
  return CATALOG_SEED.length;
}

/** Crée l'administrateur s'il n'existe pas encore (e-mail comparé en minuscules). */
export async function seedAdmin(
  ds: DataSource,
  email: string,
  password: string,
): Promise<'created' | 'exists'> {
  const repo = ds.getRepository(User);
  const normalized = email.trim().toLowerCase();
  if (await repo.existsBy({ email: normalized })) return 'exists';
  await repo.insert({
    email: normalized,
    passwordHash: await argon2.hash(password),
    role: 'admin',
  });
  return 'created';
}

async function main(): Promise<void> {
  // Import tardif : data-source.ts lit l'environnement dès son chargement.
  const { default: ds } = await import('../database/data-source');
  await ds.initialize();
  try {
    await ds.runMigrations();
    const inserted = await seedCatalog(ds);
    console.log(
      inserted > 0
        ? `Catalogue : ${inserted} meubles insérés.`
        : 'Catalogue : déjà rempli, rien à faire.',
    );

    const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      const result = await seedAdmin(ds, ADMIN_EMAIL, ADMIN_PASSWORD);
      console.log(
        result === 'created'
          ? `Administrateur créé : ${ADMIN_EMAIL.trim().toLowerCase()}.`
          : `Administrateur ${ADMIN_EMAIL.trim().toLowerCase()} : existe déjà, rien à faire.`,
      );
    } else {
      console.log(
        'Administrateur : ADMIN_EMAIL / ADMIN_PASSWORD non définis, rien à faire.',
      );
    }
  } finally {
    await ds.destroy();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('Échec du seed :', err);
    process.exit(1);
  });
}
