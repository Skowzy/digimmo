import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity';
import { seedCatalog } from '../src/scripts/seed';
import { createTestApp } from './utils/test-app';

const PASSWORD = 'motdepasse-solide';
const NEW_ITEM = {
  category: 'sejour',
  name: 'Table basse',
  widthCm: 100,
  depthCm: 50,
  symbol: 'table-basse',
};

describe('Catalogue de meubles', () => {
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
    await seedCatalog(ds);
  });

  /** Inscrit un utilisateur et renvoie son cookie de session. */
  async function session(email: string, admin = false): Promise<string[]> {
    const res = await ctx.http
      .post('/api/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    if (admin)
      await ds.getRepository(User).update({ email }, { role: 'admin' });
    return res.headers['set-cookie'] as unknown as string[];
  }

  it('refuse un visiteur non connecté', async () => {
    await ctx.http.get('/api/catalog').expect(401);
    await ctx.http.post('/api/admin/catalog').send(NEW_ITEM).expect(401);
  });

  it('un utilisateur lit le catalogue trié mais ne peut pas le modifier', async () => {
    const cookie = await session('alice@example.com');
    const res = await ctx.http
      .get('/api/catalog')
      .set('Cookie', cookie)
      .expect(200);
    const items = res.body as { category: string; name: string }[];
    expect(items).toHaveLength(20);
    const order = ['chambre', 'cuisine', 'sdb', 'sejour', 'autre'];
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1];
      const b = items[i];
      const ca = order.indexOf(a.category);
      const cb = order.indexOf(b.category);
      expect(ca <= cb).toBe(true);
      if (ca === cb) expect(a.name.localeCompare(b.name, 'fr') <= 0).toBe(true);
    }

    const denied = { message: 'Accès réservé aux administrateurs.' };
    const id = '00000000-0000-4000-8000-000000000000';
    const post = await ctx.http
      .post('/api/admin/catalog')
      .set('Cookie', cookie)
      .send(NEW_ITEM);
    expect(post.status).toBe(403);
    expect(post.body).toMatchObject(denied);
    await ctx.http
      .patch(`/api/admin/catalog/${id}`)
      .set('Cookie', cookie)
      .send({ name: 'x' })
      .expect(403);
    await ctx.http
      .delete(`/api/admin/catalog/${id}`)
      .set('Cookie', cookie)
      .expect(403);
  });

  it('un administrateur gère le catalogue (CRUD)', async () => {
    const cookie = await session('admin@example.com', true);
    const created = await ctx.http
      .post('/api/admin/catalog')
      .set('Cookie', cookie)
      .send(NEW_ITEM)
      .expect(201);
    expect(created.body).toMatchObject(NEW_ITEM);
    const id = (created.body as { id: string }).id;

    const patched = await ctx.http
      .patch(`/api/admin/catalog/${id}`)
      .set('Cookie', cookie)
      .send({ widthCm: 120 })
      .expect(200);
    expect(patched.body).toMatchObject({ ...NEW_ITEM, id, widthCm: 120 });

    const list = await ctx.http
      .get('/api/catalog')
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toHaveLength(21);

    await ctx.http
      .delete(`/api/admin/catalog/${id}`)
      .set('Cookie', cookie)
      .expect(204);
    await ctx.http
      .delete(`/api/admin/catalog/${id}`)
      .set('Cookie', cookie)
      .expect(404);
    await ctx.http
      .patch(`/api/admin/catalog/${id}`)
      .set('Cookie', cookie)
      .send({ name: 'x' })
      .expect(404);
  });

  it("valide les entrées de l'administrateur", async () => {
    const cookie = await session('admin@example.com', true);
    await ctx.http
      .post('/api/admin/catalog')
      .set('Cookie', cookie)
      .send({ ...NEW_ITEM, widthCm: 0 })
      .expect(400);
    await ctx.http
      .post('/api/admin/catalog')
      .set('Cookie', cookie)
      .send({ ...NEW_ITEM, id: '00000000-0000-4000-8000-000000000000' })
      .expect(400);
    await ctx.http
      .patch('/api/admin/catalog/pas-un-uuid')
      .set('Cookie', cookie)
      .send({ name: 'x' })
      .expect(400);
    await ctx.http
      .delete('/api/admin/catalog/pas-un-uuid')
      .set('Cookie', cookie)
      .expect(400);
    const id = '00000000-0000-4000-8000-000000000000';
    await ctx.http
      .patch(`/api/admin/catalog/${id}`)
      .set('Cookie', cookie)
      .send({})
      .expect(400);
    await ctx.http
      .patch(`/api/admin/catalog/${id}`)
      .set('Cookie', cookie)
      .send({ widthCm: 1001 })
      .expect(400);
  });
});
