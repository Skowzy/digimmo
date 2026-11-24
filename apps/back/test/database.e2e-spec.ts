import type { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { Model } from 'mongoose';
import type { DataSource } from 'typeorm';
import { PlanDoc } from '../src/plans/plan.schema';
import { createTestApp } from './utils/test-app';

describe('couche de données', () => {
  let app: INestApplication;
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let ds: DataSource;
  let plans: Model<PlanDoc>;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    ds = app.get<DataSource>(getDataSourceToken());
    plans = app.get<Model<PlanDoc>>(getModelToken(PlanDoc.name));
    expect(app.get(getConnectionToken())).toBeDefined();
  });
  beforeEach(async () => {
    await ctx.reset();
  });
  afterAll(async () => {
    await app.close();
  });

  const insertUser = (email: string) =>
    ds.query<{ id: string }[]>(
      `INSERT INTO "user" (email, password_hash) VALUES ($1, 'x') RETURNING id`,
      [email],
    );

  it('refuse deux utilisateurs avec le même e-mail', async () => {
    await insertUser('a@b.fr');
    await expect(insertUser('a@b.fr')).rejects.toThrow(/unique|duplicate/i);
  });

  it('supprime les projets en cascade avec leur propriétaire', async () => {
    const [u] = await insertUser('c@d.fr');
    await ds.query(
      `INSERT INTO project (owner_id, name, terrain_polygon, street_edge, setback_street_cm, setback_sides_cm, max_footprint_pct, min_areas_m2)
       VALUES ($1, 'P', '[]', 0, 500, 300, 40, '{}')`,
      [u.id],
    );
    await ds.query(`DELETE FROM "user" WHERE id = $1`, [u.id]);
    const rows = await ds.query<unknown[]>(`SELECT 1 FROM project`);
    expect(rows).toHaveLength(0);
  });

  it('refuse deux PlanDoc avec le même projectId', async () => {
    await plans.create({ projectId: 'p1', levels: [], stairs: null });
    await expect(
      plans.create({ projectId: 'p1', levels: [], stairs: null }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('reset() vide PostgreSQL et MongoDB mais garde le schéma', async () => {
    await insertUser('e@f.fr');
    await plans.create({ projectId: 'p2', levels: [], stairs: null });
    await ctx.reset();
    expect(await ds.query<unknown[]>(`SELECT 1 FROM "user"`)).toHaveLength(0);
    expect(await plans.countDocuments()).toBe(0);
  });
});
