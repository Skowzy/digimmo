import { getDataSourceToken } from '@nestjs/typeorm';
import { DEFAULT_RULE_PARAMS } from '@digimmo/domain';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity';
import { createTestApp } from './utils/test-app';

const PASSWORD = 'motdepasse-solide';
const NEW_PROJECT = {
  name: 'Maison de campagne',
  terrain: { widthCm: 2000, depthCm: 3000, street: 'south' },
};

describe('Projets', () => {
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

  async function session(email: string, admin = false): Promise<string[]> {
    const res = await ctx.http
      .post('/api/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    if (admin)
      await ds.getRepository(User).update({ email }, { role: 'admin' });
    return res.headers['set-cookie'] as unknown as string[];
  }

  async function create(cookie: string[], body: object = NEW_PROJECT) {
    const res = await ctx.http
      .post('/api/projects')
      .set('Cookie', cookie)
      .send(body)
      .expect(201);
    return res.body as {
      id: string;
      name: string;
      site: { boundary: unknown[]; streetEdge: number };
      rules: unknown;
      updatedAt: string;
    };
  }

  it('refuse un visiteur non connecté', async () => {
    await ctx.http.get('/api/projects').expect(401);
    await ctx.http.post('/api/projects').send(NEW_PROJECT).expect(401);
  });

  it('crée un projet avec terrain rectangulaire et règles par défaut', async () => {
    const cookie = await session('alice@example.com');
    const p = await create(cookie);
    expect(p.name).toBe('Maison de campagne');
    expect(p.site.boundary).toHaveLength(4);
    expect(p.site.streetEdge).toBe(2);
    expect(p.rules).toEqual(DEFAULT_RULE_PARAMS);
    const got = await ctx.http
      .get(`/api/projects/${p.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(got.body).toEqual(p);
  });

  it('liste uniquement mes projets, le plus récemment modifié en premier', async () => {
    const alice = await session('alice@example.com');
    const bob = await session('bob@example.com');
    const a1 = await create(alice, { ...NEW_PROJECT, name: 'A1' });
    const a2 = await create(alice, { ...NEW_PROJECT, name: 'A2' });
    await create(bob, { ...NEW_PROJECT, name: 'B1' });
    await ctx.http
      .patch(`/api/projects/${a1.id}`)
      .set('Cookie', alice)
      .send({ name: 'A1 bis' })
      .expect(200);
    const res = await ctx.http
      .get('/api/projects')
      .set('Cookie', alice)
      .expect(200);
    expect((res.body as { id: string }[]).map((p) => p.id)).toEqual([
      a1.id,
      a2.id,
    ]);
  });

  it('modifie nom, terrain (remplacé en entier) et règles', async () => {
    const cookie = await session('alice@example.com');
    const p = await create(cookie);
    const rules = { ...DEFAULT_RULE_PARAMS, maxFootprintPct: 30 };
    const res = await ctx.http
      .patch(`/api/projects/${p.id}`)
      .set('Cookie', cookie)
      .send({
        name: '  Renommé ',
        terrain: { widthCm: 1500, depthCm: 2500, street: 'north' },
        rules,
      })
      .expect(200);
    const body = res.body as typeof p;
    expect(body.name).toBe('Renommé');
    expect(body.site.streetEdge).toBe(0);
    expect(body.site.boundary[2]).toEqual({ x: 1500, y: 2500 });
    expect(body.rules).toEqual(rules);
  });

  it("Bob et un admin n'ont aucun accès au projet d'Alice", async () => {
    const alice = await session('alice@example.com');
    const bob = await session('bob@example.com');
    const admin = await session('root@example.com', true);
    const p = await create(alice);
    for (const cookie of [bob, admin]) {
      const url = `/api/projects/${p.id}`;
      const g = await ctx.http.get(url).set('Cookie', cookie);
      expect(g.status).toBe(404);
      expect(g.body).toMatchObject({ message: 'Projet introuvable.' });
      await ctx.http
        .patch(url)
        .set('Cookie', cookie)
        .send({ name: 'Piraté' })
        .expect(404);
      await ctx.http.delete(url).set('Cookie', cookie).expect(404);
      const list = await ctx.http.get('/api/projects').set('Cookie', cookie);
      expect(list.body).toEqual([]);
    }
    const after = await ctx.http
      .get(`/api/projects/${p.id}`)
      .set('Cookie', alice)
      .expect(200);
    expect(after.body).toEqual(p);
  });

  it('rejette les données invalides', async () => {
    const cookie = await session('alice@example.com');
    const p = await create(cookie);
    const bad = (terrain: object) => ({ ...NEW_PROJECT, terrain });
    const t = NEW_PROJECT.terrain;
    for (const body of [
      bad({ ...t, widthCm: 499 }),
      bad({ ...t, depthCm: 100001 }),
      bad({ ...t, street: 'haut' }),
      { ...NEW_PROJECT, extra: 1 },
      { ...NEW_PROJECT, name: '   ' },
      { ...NEW_PROJECT, rules: { ...DEFAULT_RULE_PARAMS, maxFootprintPct: 0 } },
      { ...NEW_PROJECT, rules: { setbackStreetCm: 500 } },
    ]) {
      const res = await ctx.http
        .post('/api/projects')
        .set('Cookie', cookie)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ message: 'Données invalides' });
    }
    await ctx.http
      .patch(`/api/projects/${p.id}`)
      .set('Cookie', cookie)
      .send({})
      .expect(400);
    await ctx.http
      .patch(`/api/projects/${p.id}`)
      .set('Cookie', cookie)
      .send({ terrain: { widthCm: 1000 } })
      .expect(400);
    const res = await ctx.http
      .get('/api/projects/pas-un-uuid')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ message: 'Identifiant invalide.' });
  });

  it('supprime un projet : 204 puis 404', async () => {
    const cookie = await session('alice@example.com');
    const p = await create(cookie);
    await ctx.http
      .delete(`/api/projects/${p.id}`)
      .set('Cookie', cookie)
      .expect(204);
    await ctx.http
      .get(`/api/projects/${p.id}`)
      .set('Cookie', cookie)
      .expect(404);
  });
});
