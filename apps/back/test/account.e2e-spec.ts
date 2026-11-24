import { getConnectionToken } from '@nestjs/mongoose';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { Connection } from 'mongoose';
import type { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';

const PASSWORD = 'motdepasse-solide';
const NEW_PROJECT = {
  name: 'Maison de campagne',
  terrain: { widthCm: 2000, depthCm: 3000, street: 'north' },
};
const PLAN = {
  levels: [
    {
      id: 'rdc',
      rooms: [
        {
          id: 'sej',
          type: 'sejour',
          name: 'Séjour',
          rect: { x: 500, y: 500, w: 600, h: 400 },
        },
      ],
      openings: [],
      furniture: [],
    },
  ],
  stairs: null,
};

describe('Mon compte', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await ctx.reset();
  });

  async function session(email: string): Promise<string[]> {
    const res = await ctx.http
      .post('/api/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    return res.headers['set-cookie'] as unknown as string[];
  }
  async function project(cookie: string[], withPlan: boolean) {
    const res = await ctx.http
      .post('/api/projects')
      .set('Cookie', cookie)
      .send(NEW_PROJECT)
      .expect(201);
    const id = (res.body as { id: string }).id;
    if (withPlan)
      await ctx.http
        .put(`/api/projects/${id}/plan`)
        .set('Cookie', cookie)
        .send(PLAN)
        .expect(200);
    return id;
  }
  const pg = (sql: string) =>
    ctx.app.get<DataSource>(getDataSourceToken()).query<unknown[]>(sql);
  const plansCount = () =>
    ctx.app
      .get<Connection>(getConnectionToken())
      .db!.collection('plans')
      .countDocuments();

  it("export : mes projets et plans, pas ceux d'autrui, aucun secret", async () => {
    const a = await session('a@example.com');
    const b = await session('bob@example.com');
    const withPlan = await project(a, true);
    const noPlan = await project(a, false);
    const bobId = await project(b, true);

    const res = await ctx.http
      .get('/api/me/export')
      .set('Cookie', a)
      .expect(200);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="digimmo-export.json"',
    );
    expect(res.headers['cache-control']).toContain('no-store');
    const body = res.body as {
      exportedAt: string;
      user: Record<string, unknown>;
      projects: { id: string; plan: unknown }[];
    };
    expect(Number.isNaN(Date.parse(body.exportedAt))).toBe(false);
    expect(Object.keys(body.user).sort()).toEqual([
      'createdAt',
      'email',
      'role',
    ]);
    expect(body.user.email).toBe('a@example.com');
    expect(body.projects.map((p) => p.id).sort()).toEqual(
      [withPlan, noPlan].sort(),
    );
    expect(body.projects.find((p) => p.id === withPlan)!.plan).toEqual(PLAN);
    expect(body.projects.find((p) => p.id === noPlan)!.plan).toBeNull();
    const raw = res.text;
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('argon2');
    expect(raw).not.toContain(bobId);
    expect(raw).not.toContain('bob@example.com');
  });

  it('export sans session : 401', async () => {
    await ctx.http.get('/api/me/export').expect(401);
  });

  it('DELETE avec mauvais mot de passe : 403 et compte intact', async () => {
    const a = await session('a@example.com');
    await project(a, true);
    const res = await ctx.http
      .delete('/api/me')
      .set('Cookie', a)
      .send({ password: 'mauvais-mot-de-passe' })
      .expect(403);
    expect((res.body as { message: string }).message).toBe(
      'Mot de passe incorrect.',
    );
    await ctx.http.get('/api/auth/me').set('Cookie', a).expect(200);
    expect(await plansCount()).toBe(1);
  });

  it('DELETE sans mot de passe ou avec clé étrangère : 400', async () => {
    const a = await session('a@example.com');
    await ctx.http.delete('/api/me').set('Cookie', a).send({}).expect(400);
    await ctx.http
      .delete('/api/me')
      .set('Cookie', a)
      .send({ password: PASSWORD, x: 1 })
      .expect(400);
  });

  it("DELETE correct : 204, plus rien pour l'utilisateur, ancien cookie refusé", async () => {
    const a = await session('a@example.com');
    const b = await session('bob@example.com');
    await project(a, true);
    await project(a, true);
    const bobId = await project(b, true);
    // Jeton de réinitialisation pour a.
    await ctx.http
      .post('/api/auth/password/forgot')
      .send({ email: 'a@example.com' })
      .expect(202);
    expect((await pg(`SELECT 1 FROM password_reset`)).length).toBeGreaterThan(
      0,
    );

    const res = await ctx.http
      .delete('/api/me')
      .set('Cookie', a)
      .send({ password: PASSWORD })
      .expect(204);
    const cleared = (res.headers['set-cookie'] as unknown as string[]).join(
      ';',
    );
    expect(cleared).toContain('digimmo_session=;');

    expect(
      await pg(`SELECT 1 FROM "user" WHERE email = 'a@example.com'`),
    ).toEqual([]);
    expect(await pg(`SELECT 1 FROM password_reset`)).toEqual([]);
    expect((await pg(`SELECT id FROM project`)) as { id: string }[]).toEqual([
      { id: bobId },
    ]);
    expect(await plansCount()).toBe(1);

    // L'ancien cookie, encore signé et non expiré, ne vaut plus rien.
    await ctx.http.get('/api/auth/me').set('Cookie', a).expect(401);
    await ctx.http.get('/api/projects').set('Cookie', a).expect(401);
    // Bob n'est pas touché.
    await ctx.http.get('/api/projects').set('Cookie', b).expect(200);
  });

  it('DELETE : limité à 5 essais par minute', async () => {
    const a = await session('a@example.com');
    for (let i = 0; i < 5; i++)
      await ctx.http
        .delete('/api/me')
        .set('Cookie', a)
        .send({ password: 'mauvais-mot-de-passe' })
        .expect(403);
    await ctx.http
      .delete('/api/me')
      .set('Cookie', a)
      .send({ password: 'mauvais-mot-de-passe' })
      .expect(429);
  });
});
