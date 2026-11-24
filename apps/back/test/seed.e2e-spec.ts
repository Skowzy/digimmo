import type { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { seedAdmin } from '../src/scripts/seed';
import { User } from '../src/users/user.entity';
import { createTestApp } from './utils/test-app';

describe('seedAdmin', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let ds: DataSource;

  beforeAll(async () => {
    ctx = await createTestApp();
    ds = ctx.app.get<DataSource>(getDataSourceToken());
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await ctx.reset();
  });

  it('crée l’administrateur, puis signale qu’il existe', async () => {
    expect(await seedAdmin(ds, 'Admin@Example.com', 'mot-de-passe-long')).toBe(
      'created',
    );
    expect(await seedAdmin(ds, 'admin@example.com', 'mot-de-passe-long')).toBe(
      'exists',
    );
  });

  it('ne promeut pas un compte existant non administrateur', async () => {
    await ctx.http
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'motdepasse-solide' })
      .expect(201);
    expect(await seedAdmin(ds, 'alice@example.com', 'mot-de-passe-long')).toBe(
      'exists-not-admin',
    );
    const u = await ds
      .getRepository(User)
      .findOneByOrFail({ email: 'alice@example.com' });
    expect(u.role).toBe('user');
  });

  it('refuse un mot de passe de moins de 10 caractères', async () => {
    await expect(seedAdmin(ds, 'a@example.com', 'court')).rejects.toThrow(
      'ADMIN_PASSWORD doit contenir au moins 10 caractères.',
    );
  });
});
