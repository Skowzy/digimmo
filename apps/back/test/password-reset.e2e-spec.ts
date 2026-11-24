import { createTestApp } from './utils/test-app';

const PASSWORD = 'motdepasse-solide';
const NEW_PASSWORD = 'tout-nouveau-mot-de-passe';
const MESSAGE =
  "Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.";

describe('Mot de passe oublié', () => {
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

  const register = () =>
    ctx.http
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: PASSWORD });
  const forgot = (email: string) =>
    ctx.http.post('/api/auth/password/forgot').send({ email });
  const reset = (token: string, password = NEW_PASSWORD) =>
    ctx.http.post('/api/auth/password/reset').send({ token, password });
  const login = (password: string) =>
    ctx.http
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password });
  const tokenFromMail = () => {
    const link = ctx.outbox[0].text.match(/https?:\/\/\S+/)![0];
    return new URL(link).searchParams.get('token')!;
  };

  it('répond pareil pour une adresse connue et inconnue, un seul mail pour la connue', async () => {
    await register().expect(201);
    const known = await forgot('Alice@Example.com').expect(202);
    const unknown = await forgot('personne@example.com').expect(202);
    expect(known.body).toEqual({ message: MESSAGE });
    expect(unknown.body).toEqual(known.body);
    expect(ctx.outbox).toHaveLength(1);
    expect(ctx.outbox[0].to).toBe('alice@example.com');
    expect(ctx.outbox[0].subject).toBe(
      'Digimmo : réinitialisation de votre mot de passe',
    );
    expect(ctx.outbox[0].text).toContain(
      'http://localhost:5173/mot-de-passe/reinitialiser?token=',
    );
  });

  it('réinitialise, change le mot de passe, usage unique', async () => {
    await register().expect(201);
    await forgot('alice@example.com').expect(202);
    const token = tokenFromMail();
    await reset(token).expect(204);
    await login(NEW_PASSWORD).expect(200);
    await login(PASSWORD).expect(401);
    const again = await reset(token).expect(400);
    expect(again.body).toEqual({ message: 'Lien invalide ou expiré.' });
  });

  it('deux demandes : le premier jeton est refusé après usage du second', async () => {
    await register().expect(201);
    await forgot('alice@example.com').expect(202);
    await forgot('alice@example.com').expect(202);
    const first = new URL(
      ctx.outbox[0].text.match(/https?:\/\/\S+/)![0],
    ).searchParams.get('token')!;
    const second = new URL(
      ctx.outbox[1].text.match(/https?:\/\/\S+/)![0],
    ).searchParams.get('token')!;
    await reset(second).expect(204);
    await reset(first).expect(400);
  });

  it('refuse un jeton inventé', async () => {
    const res = await reset('inventé').expect(400);
    expect(res.body).toEqual({ message: 'Lien invalide ou expiré.' });
  });

  it('refuse un nouveau mot de passe trop court et les champs inconnus', async () => {
    await reset('x', 'court').expect(400);
    await ctx.http
      .post('/api/auth/password/reset')
      .send({ token: 'x', password: NEW_PASSWORD, role: 'admin' })
      .expect(400);
  });

  it('invalide les sessions existantes après la réinitialisation', async () => {
    const res = await register().expect(201);
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
    await ctx.http.get('/api/auth/me').set('Cookie', cookie).expect(200);
    await forgot('alice@example.com').expect(202);
    // Le jeton de session date de la même seconde que le changement : on attend la suivante.
    await new Promise((r) => setTimeout(r, 1100));
    await reset(tokenFromMail()).expect(204);
    await ctx.http.get('/api/auth/me').set('Cookie', cookie).expect(401);
    const fresh = await login(NEW_PASSWORD).expect(200);
    const newCookie = (
      fresh.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];
    await ctx.http.get('/api/auth/me').set('Cookie', newCookie).expect(200);
  });

  it('limite forgot à 3 par minute (429 à la 4e)', async () => {
    for (let i = 0; i < 3; i++) await forgot('x@example.com').expect(202);
    const res = await forgot('x@example.com').expect(429);
    expect((res.body as { message: string }).message).toBe(
      'Trop de tentatives. Réessayez dans une minute.',
    );
  });

  it('limite register à 10 par minute (429 à la 11e)', async () => {
    for (let i = 0; i < 10; i++) {
      await ctx.http
        .post('/api/auth/register')
        .send({ email: `u${i}@example.com`, password: PASSWORD })
        .expect(201);
    }
    await ctx.http
      .post('/api/auth/register')
      .send({ email: 'u10@example.com', password: PASSWORD })
      .expect(429);
  });
});
