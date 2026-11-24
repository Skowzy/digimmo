import { z } from 'zod';
import type { Plan, RuleParams, Site } from './types';

const MAX = 100_000;
const coord = z.number().int().min(0).max(MAX);
const dim = z.number().int().min(1).max(MAX);
const id = z.string().min(1).max(64);
const label = z.string().min(1).max(60);

const rectSchema = z.strictObject({ x: coord, y: coord, w: dim, h: dim });
const pointSchema = z.strictObject({ x: coord, y: coord });

const roomTypes = ['sejour', 'cuisine', 'chambre', 'sdb', 'wc', 'entree', 'degagement', 'garage', 'autre'] as const;
const roomTypeSchema = z.enum(roomTypes);

const roomSchema = z.strictObject({ id, type: roomTypeSchema, name: label, rect: rectSchema });

const openingSchema = z
  .strictObject({
    id,
    kind: z.enum(['door', 'window']),
    orientation: z.enum(['h', 'v']),
    fixed: coord,
    start: coord,
    width: dim,
    swing: z.strictObject({ hinge: z.enum(['start', 'end']), side: z.enum(['neg', 'pos']) }).optional(),
  })
  .superRefine((o, ctx) => {
    if (o.kind === 'door' && !o.swing) ctx.addIssue({ code: 'custom', path: ['swing'], message: 'swing obligatoire pour une porte' });
    if (o.kind === 'window' && o.swing) ctx.addIssue({ code: 'custom', path: ['swing'], message: 'swing interdit pour une fenêtre' });
  });

const furnitureSchema = z.strictObject({
  id,
  catalogId: z.string().min(1).max(60),
  label,
  x: coord,
  y: coord,
  w: dim,
  d: dim,
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
});

const levelSchema = z.strictObject({
  id: z.enum(['rdc', 'r1']),
  rooms: z.array(roomSchema).max(100),
  openings: z.array(openingSchema).max(200),
  furniture: z.array(furnitureSchema).max(500),
});

export const planSchema = z
  .strictObject({
    levels: z.array(levelSchema).min(1).max(2),
    stairs: z.strictObject({ rect: rectSchema }).nullable(),
  })
  .superRefine((p, ctx) => {
    p.levels.forEach((l, i) => {
      const expected = i === 0 ? 'rdc' : 'r1';
      if (l.id !== expected) ctx.addIssue({ code: 'custom', path: ['levels', i, 'id'], message: `le niveau ${i} doit avoir l'id '${expected}'` });
    });
    if (p.stairs && !p.levels.some((l) => l.id === 'r1'))
      ctx.addIssue({ code: 'custom', path: ['stairs'], message: 'escalier sans niveau r1' });
    const seen = new Set<string>();
    p.levels.forEach((l, li) => {
      const groups = [['rooms', l.rooms], ['openings', l.openings], ['furniture', l.furniture]] as const;
      for (const [key, items] of groups)
        items.forEach((it, i) => {
          if (it.id === 'stairs') ctx.addIssue({ code: 'custom', path: ['levels', li, key, i, 'id'], message: "id réservé 'stairs'" });
          if (seen.has(it.id)) ctx.addIssue({ code: 'custom', path: ['levels', li, key, i, 'id'], message: `id dupliqué '${it.id}'` });
          seen.add(it.id);
        });
    });
  });

export const ruleParamsSchema = z.strictObject({
  setbackStreetCm: z.number().int().min(0).max(5000),
  setbackSidesCm: z.number().int().min(0).max(5000),
  maxFootprintPct: z.number().min(1).max(100),
  // zod retire la clé __proto__ au parsing du record : on la détecte sur l'entrée brute
  minAreasM2: z
    .unknown()
    .superRefine((o, ctx) => {
      if (typeof o === 'object' && o !== null && Object.hasOwn(o, '__proto__'))
        ctx.addIssue({ code: 'custom', message: 'clé __proto__ interdite' });
    })
    .pipe(z.partialRecord(roomTypeSchema, z.number().min(0).max(100))),
});

export const siteSchema = z
  .strictObject({
    boundary: z.array(pointSchema).min(3).max(50),
    streetEdge: z.number().int().min(0),
  })
  .superRefine((s, ctx) => {
    if (s.streetEdge > s.boundary.length - 1)
      ctx.addIssue({ code: 'custom', path: ['streetEdge'], message: `streetEdge doit être dans [0, ${s.boundary.length - 1}]` });
    const pts = s.boundary;
    let area2 = 0;
    let sign = 0;
    let convex = true;
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length]!;
      const r = pts[(i + 2) % pts.length]!;
      area2 += p.x * q.y - q.x * p.y;
      const cross = (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
      if (cross !== 0) {
        if (sign !== 0 && Math.sign(cross) !== sign) convex = false;
        sign = Math.sign(cross);
      }
    });
    if (area2 === 0) ctx.addIssue({ code: 'custom', path: ['boundary'], message: 'le terrain doit avoir une surface non nulle' });
    else if (!convex) ctx.addIssue({ code: 'custom', path: ['boundary'], message: 'le terrain doit être convexe' });
  });

// Garde de dérive : le schéma doit rester assignable aux types du domaine.
const _plan: Plan = {} as z.infer<typeof planSchema>;
const _rules: RuleParams = {} as z.infer<typeof ruleParamsSchema>;
const _site: Site = {} as z.infer<typeof siteSchema>;
void _plan; void _rules; void _site;

export function parsePlan(input: unknown): { ok: true; plan: Plan } | { ok: false; issues: string[] } {
  const r = planSchema.safeParse(input);
  if (r.success) return { ok: true, plan: r.data };
  return { ok: false, issues: r.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)) };
}
