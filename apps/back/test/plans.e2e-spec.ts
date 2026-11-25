import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { DEFAULT_RULE_PARAMS } from '@digimmo/domain';
import { getModelToken } from '@nestjs/mongoose';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Model } from 'mongoose';
import type { Repository } from 'typeorm';
import { PlanDoc } from '../src/plans/plan.schema';
import { PlansService } from '../src/plans/plans.service';
import { Project } from '../src/projects/project.entity';
import { createTestApp } from './utils/test-app';

const PASSWORD = 'motdepasse-solide';
const NEW_PROJECT = {
  name: 'Maison de campagne',
  terrain: { widthCm: 2000, depthCm: 3000, street: 'north' },
};
const EMPTY = {
  levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }],
  stairs: null,
};
const DEMO = {
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
        {
          id: 'cui',
          type: 'cuisine',
          name: 'Cuisine',
          rect: { x: 1100, y: 500, w: 400, h: 400 },
        },
        {
          id: 'cha',
          type: 'chambre',
          name: 'Chambre',
          rect: { x: 500, y: 900, w: 300, h: 300 },
        },
      ],
      openings: [
        {
          id: 'p1',
          kind: 'door',
          orientation: 'h',
          fixed: 900,
          start: 600,
          width: 90,
          swing: { hinge: 'start', side: 'pos' },
        },
      ],
      furniture: [
        {
          id: 'lit',
          catalogId: 'bed',
          label: 'Lit',
          x: 520,
          y: 1000,
          w: 140,
          d: 190,
          rotation: 0,
        },
      ],
    },
  ],
  stairs: null,
};

type Body = {
  plan: unknown;
  validation: { violations: { code: string }[]; checkedAt: string };
};

describe('Plans', () => {
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
  async function project(cookie: string[]): Promise<string> {
    const res = await ctx.http
      .post('/api/projects')
      .set('Cookie', cookie)
      .send(NEW_PROJECT)
      .expect(201);
    return (res.body as { id: string }).id;
  }
  const url = (id: string) => `/api/projects/${id}/plan`;
  const getPlan = async (cookie: string[], id: string) =>
    (await ctx.http.get(url(id)).set('Cookie', cookie).expect(200))
      .body as Body;
  const put = (cookie: string[], id: string, body: unknown) =>
    ctx.http
      .put(url(id))
      .set('Cookie', cookie)
      .send(body as object);
  const codes = (b: Body) => b.validation.violations.map((v) => v.code);
  const plansCount = () =>
    ctx.app
      .get<Connection>(getConnectionToken())
      .db!.collection('plans')
      .countDocuments();

  it('une revalidation qui a lu une ancienne version du plan ne l’écrase pas', async () => {
    const c = await session('a@example.com');
    const id = await project(c);
    await put(c, id, DEMO).expect(200);
    const model = ctx.app.get<Model<PlanDoc>>(getModelToken(PlanDoc.name));
    const stale = await model.findOne({ projectId: id }).lean();
    // Une sauvegarde plus récente arrive pendant la revalidation : ici, un plan aux pièces qui se chevauchent
    // est lu par la revalidation (version périmée), alors que le plan stocké a changé entre-temps.
    const overlapping = JSON.parse(JSON.stringify(DEMO)) as typeof DEMO;
    overlapping.levels[0].rooms[1].rect.x = 1000;
    jest.spyOn(model, 'findOne').mockReturnValueOnce({
      lean: () => Promise.resolve({ ...stale, levels: overlapping.levels }),
    } as never);
    await new Promise((r) => setTimeout(r, 5));
    await put(c, id, DEMO).expect(200); // la version stockée change (updatedAt)
    const entity = await ctx.app
      .get<Repository<Project>>(getRepositoryToken(Project))
      .findOneByOrFail({ id });
    await ctx.app.get(PlansService).revalidate(entity);
    expect(codes(await getPlan(c, id))).toEqual([]);
  });

  it("GET d'un projet neuf : plan vide, aucune violation, rien d'écrit", async () => {
    const c = await session('a@example.com');
    const id = await project(c);
    const b = await getPlan(c, id);
    expect(b.plan).toEqual(EMPTY);
    expect(b.validation.violations).toEqual([]);
    expect(typeof b.validation.checkedAt).toBe('string');
    expect(await plansCount()).toBe(0);
  });

  it("PUT d'une maison valide puis GET à l'identique", async () => {
    const c = await session('a@example.com');
    const id = await project(c);
    const res = await put(c, id, DEMO).expect(200);
    expect((res.body as Body).validation.violations).toEqual([]);
    const b = await getPlan(c, id);
    expect(b.plan).toEqual(DEMO);
    expect(b.validation.violations).toEqual([]);
  });

  it("PUT d'une maison à 3 m de la voie : 200 avec SETBACK_STREET", async () => {
    const c = await session('a@example.com');
    const id = await project(c);
    const close = {
      ...DEMO,
      levels: [
        {
          ...DEMO.levels[0],
          rooms: [
            {
              id: 'a',
              type: 'autre',
              name: 'A',
              rect: { x: 500, y: 300, w: 600, h: 400 },
            },
          ],
          openings: [],
          furniture: [],
        },
      ],
    };
    const res = await put(c, id, close).expect(200);
    expect(codes(res.body as Body)).toContain('SETBACK_STREET');
    expect(codes(await getPlan(c, id))).toContain('SETBACK_STREET');
  });

  it('PUT invalide (w: 420.5) : 400 avec issues, plan précédent inchangé', async () => {
    const c = await session('a@example.com');
    const id = await project(c);
    await put(c, id, DEMO).expect(200);
    const bad = structuredClone(DEMO);
    bad.levels[0].rooms[0].rect.w = 420.5;
    const res = await put(c, id, bad).expect(400);
    const body = res.body as { message: string; issues: unknown[] };
    expect(body.message).toBe('Format de plan invalide.');
    expect(body.issues.length).toBeGreaterThan(0);
    expect((await getPlan(c, id)).plan).toEqual(DEMO);
  });

  it('ne stocke jamais le corps brut : clés étrangères ou opérateurs Mongo rejetés', async () => {
    const c = await session('a@example.com');
    const id = await project(c);
    await put(c, id, { ...EMPTY, extra: 1 }).expect(400);
    const evil = structuredClone(EMPTY) as {
      levels: Record<string, unknown>[];
    };
    evil.levels[0]['$set'] = { x: 1 };
    await put(c, id, evil).expect(400);
    await put(c, id, { ...EMPTY, 'a.b': 1, $where: '1' }).expect(400);
    expect(await plansCount()).toBe(0);
  });

  it('PATCH des règles revalide le plan enregistré', async () => {
    const c = await session('a@example.com');
    const id = await project(c);
    const close = {
      ...EMPTY,
      levels: [
        {
          ...EMPTY.levels[0],
          rooms: [
            {
              id: 'a',
              type: 'autre',
              name: 'A',
              rect: { x: 500, y: 300, w: 600, h: 400 },
            },
          ],
        },
      ],
    };
    await put(c, id, close).expect(200);
    expect(codes(await getPlan(c, id))).toContain('SETBACK_STREET');
    await ctx.http
      .patch(`/api/projects/${id}`)
      .set('Cookie', c)
      .send({ rules: { ...DEFAULT_RULE_PARAMS, setbackStreetCm: 200 } })
      .expect(200);
    expect(codes(await getPlan(c, id))).not.toContain('SETBACK_STREET');
  });

  it("Bob ne peut ni lire ni écrire le plan d'Alice (404)", async () => {
    const a = await session('a@example.com');
    const b = await session('b@example.com');
    const id = await project(a);
    await put(a, id, DEMO).expect(200);
    await ctx.http.get(url(id)).set('Cookie', b).expect(404);
    await put(b, id, EMPTY).expect(404);
    expect((await getPlan(a, id)).plan).toEqual(DEMO);
  });

  it('identifiant non UUID : 400', async () => {
    const c = await session('a@example.com');
    await ctx.http.get('/api/projects/nope/plan').set('Cookie', c).expect(400);
  });

  it('corps de 1,5 Mo : 413 ; JSON mal formé : 400', async () => {
    const c = await session('a@example.com');
    const id = await project(c);
    const big = JSON.stringify({ pad: 'x'.repeat(1_500_000) });
    const r1 = await ctx.http
      .put(url(id))
      .set('Cookie', c)
      .set('Content-Type', 'application/json')
      .send(big)
      .expect(413);
    expect(r1.body).toEqual({
      message: 'Plan trop volumineux (1 Mo maximum).',
    });
    const r2 = await ctx.http
      .put(url(id))
      .set('Cookie', c)
      .set('Content-Type', 'application/json')
      .send('{pas du json')
      .expect(400);
    expect(r2.body).toEqual({ message: 'JSON invalide.' });
  });

  it('DELETE du projet supprime le document de plan', async () => {
    const c = await session('a@example.com');
    const id = await project(c);
    await put(c, id, DEMO).expect(200);
    expect(await plansCount()).toBe(1);
    await ctx.http.delete(`/api/projects/${id}`).set('Cookie', c).expect(204);
    expect(await plansCount()).toBe(0);
  });
});
