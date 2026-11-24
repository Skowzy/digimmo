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
