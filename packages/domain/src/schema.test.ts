import { describe, it, expect } from 'vitest';
import { rectangularSite } from './defaults';
import { parsePlan, ruleParamsSchema, siteSchema } from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
function set(obj: Json, path: string, value: unknown): Json {
  const c = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let cur = c;
  for (const k of keys.slice(0, -1)) cur = cur[k];
  cur[keys[keys.length - 1]!] = value;
  return c;
}

const room = (id: string) => ({ id, type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 400, h: 300 } });
const door = { id: 'd1', kind: 'door', orientation: 'h', fixed: 0, start: 10, width: 90, swing: { hinge: 'start', side: 'pos' } };
const win = { id: 'w1', kind: 'window', orientation: 'h', fixed: 0, start: 10, width: 90 };
const valid = { levels: [{ id: 'rdc', rooms: [room('a')], openings: [], furniture: [] }], stairs: null };
const level = (id: string) => ({ id, rooms: [room('z' + id)], openings: [], furniture: [] });

describe('parsePlan', () => {
  it('accepte un plan valide', () => expect(parsePlan(valid).ok).toBe(true));
  it('accepte porte avec swing et fenêtre sans swing', () => {
    expect(parsePlan(set(valid, 'levels.0.openings', [door, win])).ok).toBe(true);
  });
  it('accepte un escalier avec un étage r1', () => {
    const p = { levels: [valid.levels[0], level('r1')], stairs: { rect: { x: 0, y: 0, w: 100, h: 200 } } };
    expect(parsePlan(p).ok).toBe(true);
  });
  it("réserve l'id 'stairs' (pièce, ouverture, meuble)", () => {
    expect(parsePlan(set(valid, 'levels.0.rooms.0.id', 'stairs')).ok).toBe(false);
    expect(parsePlan(set(valid, 'levels.0.openings', [{ ...win, id: 'stairs' }])).ok).toBe(false);
    const f = { id: 'stairs', catalogId: 'x', label: 'L', x: 0, y: 0, w: 10, d: 10, rotation: 0 };
    expect(parsePlan(set(valid, 'levels.0.furniture', [f])).ok).toBe(false);
  });
  it('refuse une coordonnée non entière', () => expect(parsePlan(set(valid, 'levels.0.rooms.0.rect.w', 420.5)).ok).toBe(false));
  it('refuse une dimension nulle', () => expect(parsePlan(set(valid, 'levels.0.rooms.0.rect.w', 0)).ok).toBe(false));
  it('refuse une coordonnée négative', () => expect(parsePlan(set(valid, 'levels.0.rooms.0.rect.x', -1)).ok).toBe(false));
  it('refuse une valeur au-delà de 100 000', () => expect(parsePlan(set(valid, 'levels.0.rooms.0.rect.w', 100001)).ok).toBe(false));
  it('refuse un champ inconnu', () => expect(parsePlan({ ...valid, admin: true }).ok).toBe(false));
  it('refuse un champ inconnu dans une pièce', () => expect(parsePlan(set(valid, 'levels.0.rooms.0.extra', 1)).ok).toBe(false));
  it('refuse des identifiants dupliqués', () => {
    const r = parsePlan(set(valid, 'levels.0.rooms', [room('a'), room('a')]));
    expect(r.ok).toBe(false);
  });
  it('refuse un id dupliqué entre pièce et ouverture', () => {
    expect(parsePlan(set(valid, 'levels.0.openings', [{ ...win, id: 'a' }])).ok).toBe(false);
  });
  it('refuse un escalier sans étage', () => {
    expect(parsePlan(set(valid, 'stairs', { rect: { x: 0, y: 0, w: 100, h: 200 } })).ok).toBe(false);
  });
  it('refuse une porte sans swing', () => {
    const d: Json = { ...door };
    delete d.swing;
    expect(parsePlan(set(valid, 'levels.0.openings', [d])).ok).toBe(false);
  });
  it('refuse une fenêtre avec swing', () => {
    expect(parsePlan(set(valid, 'levels.0.openings', [{ ...win, swing: door.swing }])).ok).toBe(false);
  });
  it('refuse 3 niveaux', () => {
    expect(parsePlan({ levels: [level('rdc'), level('r1'), level('r1')], stairs: null }).ok).toBe(false);
  });
  it('refuse un second niveau d\'id rdc', () => {
    expect(parsePlan({ levels: [valid.levels[0], level('rdc')], stairs: null }).ok).toBe(false);
  });
  it('refuse plus de 100 pièces par niveau', () => {
    const rooms = Array.from({ length: 101 }, (_, i) => room('r' + i));
    expect(parsePlan(set(valid, 'levels.0.rooms', rooms)).ok).toBe(false);
  });
  it('refuse un nom vide ou trop long', () => {
    expect(parsePlan(set(valid, 'levels.0.rooms.0.name', '')).ok).toBe(false);
    expect(parsePlan(set(valid, 'levels.0.rooms.0.name', 'x'.repeat(61))).ok).toBe(false);
  });
  it('refuse une entrée non objet', () => expect(parsePlan('x').ok).toBe(false));
  it('formate les issues avec leur chemin', () => {
    const r = parsePlan(set(valid, 'levels.0.rooms.0.rect.w', 420.5));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.startsWith('levels.0.rooms.0.rect.w: '))).toBe(true);
  });
});

describe('ruleParamsSchema', () => {
  const ok = { setbackStreetCm: 500, setbackSidesCm: 300, maxFootprintPct: 40, minAreasM2: { sejour: 12 } };
  it('accepte des paramètres valides', () => expect(ruleParamsSchema.safeParse(ok).success).toBe(true));
  it('refuse maxFootprintPct 0', () => expect(ruleParamsSchema.safeParse({ ...ok, maxFootprintPct: 0 }).success).toBe(false));
  it('refuse un recul > 5000', () => expect(ruleParamsSchema.safeParse({ ...ok, setbackSidesCm: 5001 }).success).toBe(false));
  it('refuse une surface minimale > 100', () => expect(ruleParamsSchema.safeParse({ ...ok, minAreasM2: { wc: 101 } }).success).toBe(false));
  it('refuse un type de pièce inconnu', () => expect(ruleParamsSchema.safeParse({ ...ok, minAreasM2: { salon: 5 } }).success).toBe(false));
});

describe('siteSchema', () => {
  const b = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
  it('accepte un terrain valide', () => expect(siteSchema.safeParse({ boundary: b, streetEdge: 0 }).success).toBe(true));
  it('refuse streetEdge hors plage', () => {
    expect(siteSchema.safeParse({ boundary: b, streetEdge: 4 }).success).toBe(false);
    expect(siteSchema.safeParse({ boundary: b, streetEdge: -1 }).success).toBe(false);
  });
  it('refuse moins de 3 sommets', () => expect(siteSchema.safeParse({ boundary: b.slice(0, 2), streetEdge: 0 }).success).toBe(false));
});

describe('restes plan 1', () => {
  it('ruleParams : clé __proto__ dans minAreasM2 refusée', () =>
    expect(ruleParamsSchema.safeParse(JSON.parse('{"setbackStreetCm":500,"setbackSidesCm":300,"maxFootprintPct":40,"minAreasM2":{"__proto__":5}}')).success).toBe(false));
  it('site : aire nulle refusée', () =>
    expect(siteSchema.safeParse({ boundary: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], streetEdge: 0 }).success).toBe(false));
  it('site : polygone non convexe (en L) refusé', () =>
    expect(siteSchema.safeParse({ boundary: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }], streetEdge: 0 }).success).toBe(false));
  it('site : rectangularSite accepté', () =>
    expect(siteSchema.safeParse(rectangularSite(2000, 3000, 'north')).success).toBe(true));
  it('site : sens anti-horaire accepté', () =>
    expect(siteSchema.safeParse({ boundary: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 }], streetEdge: 0 }).success).toBe(true));
});
