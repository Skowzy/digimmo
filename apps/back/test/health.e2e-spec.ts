import { createTestApp } from './utils/test-app';

describe('GET /api/health', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('répond 200 { status: "ok" } avec les en-têtes helmet', async () => {
    const res = await ctx.http.get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('ne limite pas le débit des routes sans @Throttle (pas d’en-tête X-RateLimit)', async () => {
    const res = await ctx.http.get('/api/health').expect(200);
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });
});

describe('Erreurs en français', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('route inconnue : 404 français', async () => {
    const res = await ctx.http.get('/api/nope').expect(404);
    expect(res.body).toEqual({ message: 'Ressource introuvable.' });
  });

  it('charset non pris en charge : 415 français', async () => {
    const res = await ctx.http
      .post('/api/auth/login')
      .set('Content-Type', 'application/json; charset=latin1')
      .send('{"a":1}')
      .expect(415);
    expect(res.body).toEqual({
      message: 'Type de contenu non pris en charge.',
    });
  });

  it('encodage de contenu invalide : 400 ou 415 français', async () => {
    const res = await ctx.http
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send('pas du gzip');
    expect([400, 415]).toContain(res.status);
    expect((res.body as { message: string }).message).toMatch(
      /^(Requête invalide|Type de contenu non pris en charge)\.$/,
    );
  });
});
