import { getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import type { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';

const PASSWORD = 'motdepasse-solide';

type Body = {
  id: string;
  email: string;
  role: string;
  message: string;
  issues: string[];
};
const bodyOf = (res: { body: unknown }) => res.body as Body;

describe('Authentification', () => {
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

  const register = (email = 'alice@example.com', password = PASSWORD) =>
    ctx.http.post('/api/auth/register').send({ email, password });

  const cookieOf = (res: { headers: Record<string, unknown> }): string[] =>
    res.headers['set-cookie'] as string[];

  it('inscrit, pose un cookie HttpOnly SameSite=Lax et /me renvoie l’utilisateur', async () => {
    const res = await register().expect(201);
    expect(bodyOf(res)).toEqual({
      id: expect.any(String) as string,
      email: 'alice@example.com',
      role: 'user',
    });
    const cookie = cookieOf(res).find((c) => c.startsWith('digimmo_session='))!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Secure');

    const me = await ctx.http
      .get('/api/auth/me')
      .set('Cookie', cookie.split(';')[0])
      .expect(200);
    expect(bodyOf(me).email).toBe('alice@example.com');
  });

  it('ne renvoie ni ne stocke jamais le mot de passe en clair', async () => {
    const res = await register().expect(201);
    expect(JSON.stringify(bodyOf(res))).not.toContain(PASSWORD);
    const ds = ctx.app.get<DataSource>(getDataSourceToken());
    const rows = await ds.query<{ passwordHash: string }[]>(
      `SELECT "password_hash" AS "passwordHash" FROM "user"`,
    );
    expect(rows[0].passwordHash.startsWith('$argon2')).toBe(true);
  });

  it('normalise l’e-mail et refuse un doublon (409)', async () => {
    await register(' Alice@Example.com ').expect(201);
    const dup = await register('ALICE@example.com').expect(409);
    expect(bodyOf(dup).message).toBe(
      'Un compte existe déjà avec cette adresse.',
    );
    await ctx.http
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: PASSWORD })
      .expect(200);
  });

  it('une inscription simultanée ne crée qu’un seul compte', async () => {
    const results = await Promise.all([
      register('bob@example.com'),
      register('bob@example.com'),
      register('bob@example.com'),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409]);
  });

  it('refuse un mot de passe de 9 caractères avec un message français', async () => {
    const res = await register('a@example.com', '123456789').expect(400);
    expect(bodyOf(res).message).toBe('Données invalides');
    expect(bodyOf(res).issues.join(' ')).toMatch(/caractères/);
  });

  it('refuse un champ inconnu (role: admin) à l’inscription', async () => {
    await ctx.http
      .post('/api/auth/register')
      .send({ email: 'x@example.com', password: PASSWORD, role: 'admin' })
      .expect(400);
  });

  it('401 identique pour mauvais mot de passe et e-mail inconnu', async () => {
    await register().expect(201);
    const bad = await ctx.http
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'mauvais-mot-de-passe' })
      .expect(401);
    const unknown = await ctx.http
      .post('/api/auth/login')
      .send({ email: 'inconnu@example.com', password: 'mauvais-mot-de-passe' })
      .expect(401);
    expect(bodyOf(bad).message).toBe('Identifiants invalides.');
    expect(bodyOf(unknown)).toEqual(bodyOf(bad));
  });

  it('logout → 204 puis /me avec le cookie effacé → 401', async () => {
    const reg = await register().expect(201);
    const session = cookieOf(reg)[0].split(';')[0];
    const out = await ctx.http
      .post('/api/auth/logout')
      .set('Cookie', session)
      .expect(204);
    const cleared = cookieOf(out).find((c) =>
      c.startsWith('digimmo_session='),
    )!;
    expect(cleared).toMatch(/digimmo_session=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    const value = cleared.split(';')[0];
    const me = await ctx.http
      .get('/api/auth/me')
      .set('Cookie', value)
      .expect(401);
    expect(bodyOf(me).message).toBe('Non authentifié.');
  });

  it('GET /me sans cookie, avec un JWT d’une autre clé ou d’un utilisateur supprimé → 401', async () => {
    await ctx.http.get('/api/auth/me').expect(401);
    const reg = await register().expect(201);
    const jwt = new JwtService({
      secret: 'une-autre-cle-une-autre-cle-une-autre-cle',
    });
    const forged = jwt.sign({ sub: bodyOf(reg).id, role: 'admin' });
    await ctx.http
      .get('/api/auth/me')
      .set('Cookie', `digimmo_session=${forged}`)
      .expect(401);

    const session = cookieOf(reg)[0].split(';')[0];
    const ds = ctx.app.get<DataSource>(getDataSourceToken());
    await ds.query(`DELETE FROM "user"`);
    await ctx.http.get('/api/auth/me').set('Cookie', session).expect(401);
  });

  it('le rôle vient de la base, pas du jeton', async () => {
    const reg = await register().expect(201);
    const jwt = new JwtService({ secret: process.env.JWT_SECRET });
    const token = jwt.sign({ sub: bodyOf(reg).id, role: 'admin' });
    const me = await ctx.http
      .get('/api/auth/me')
      .set('Cookie', `digimmo_session=${token}`)
      .expect(200);
    expect(bodyOf(me).role).toBe('user');
  });

  it('/health reste public', async () => {
    await ctx.http.get('/api/health').expect(200);
  });

  it('6e tentative de connexion en une minute → 429', async () => {
    // Test volontairement isolé : reset() vient d'être appelé (beforeEach).
    for (let i = 0; i < 5; i++) {
      await ctx.http
        .post('/api/auth/login')
        .send({ email: 'x@example.com', password: 'whatever' })
        .expect(401);
    }
    const res = await ctx.http
      .post('/api/auth/login')
      .send({ email: 'x@example.com', password: 'whatever' })
      .expect(429);
    expect(bodyOf(res).message).toBe(
      'Trop de tentatives. Réessayez dans une minute.',
    );
  });
});
