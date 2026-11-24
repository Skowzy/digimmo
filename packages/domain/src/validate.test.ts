import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_PARAMS, rectangularSite } from './defaults';
import { validatePlan } from './validate';
import type { Level, Plan } from './types';

const site = rectangularSite(2000, 3000, 'north');

describe('validatePlan', () => {
  it('plan vide → aucune violation', () => {
    expect(
      validatePlan(site, DEFAULT_RULE_PARAMS, { levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }], stairs: null }),
    ).toEqual([]);
  });

  it('maison de démonstration valide', () => {
    const rdc: Level = {
      id: 'rdc',
      rooms: [
        { id: 'sej', type: 'sejour', name: 'Séjour', rect: { x: 500, y: 500, w: 600, h: 400 } },
        { id: 'cui', type: 'cuisine', name: 'Cuisine', rect: { x: 1100, y: 500, w: 400, h: 400 } },
        { id: 'cha', type: 'chambre', name: 'Chambre', rect: { x: 500, y: 900, w: 300, h: 300 } },
      ],
      openings: [
        { id: 'p1', kind: 'door', orientation: 'h', fixed: 900, start: 600, width: 90, swing: { hinge: 'start', side: 'pos' } },
      ],
      furniture: [{ id: 'lit', catalogId: 'bed', label: 'Lit', x: 520, y: 1000, w: 140, d: 190, rotation: 0 }],
    };
    expect(validatePlan(site, DEFAULT_RULE_PARAMS, { levels: [rdc], stairs: null })).toEqual([]);
  });

  it('cumule les violations de plusieurs règles, erreurs avant alertes', () => {
    const room = { id: 'a', type: 'autre' as const, name: 'A', rect: { x: 500, y: 100, w: 600, h: 400 } };
    const plan: Plan = {
      levels: [
        { id: 'rdc', rooms: [room], openings: [], furniture: [] },
        { id: 'r1', rooms: [{ ...room, id: 'b' }], openings: [], furniture: [] },
      ],
      stairs: null,
    };
    expect(validatePlan(site, DEFAULT_RULE_PARAMS, plan).map((v) => v.code)).toEqual(['SETBACK_STREET', 'STAIRS_MISSING']);
  });

  it('place les erreurs avant les alertes (tri par sévérité)', () => {
    // Escalier mal placé (erreur, produite en dernier).
    const big = { id: 'a', type: 'autre' as const, name: 'A', rect: { x: 300, y: 500, w: 1100, h: 1000 } };
    const plan: Plan = {
      levels: [{ id: 'rdc', rooms: [big], openings: [], furniture: [] }, { id: 'r1', rooms: [{ ...big, id: 'b' }], openings: [], furniture: [] }],
      stairs: { rect: { x: 0, y: 0, w: 100, h: 100 } },
    };
    const sev = validatePlan(site, DEFAULT_RULE_PARAMS, plan).map((v) => v.severity);
    expect(sev).toEqual([...sev].sort((a, b) => (a === b ? 0 : a === 'error' ? -1 : 1)));
    expect(sev).toContain('error');
  });
  it('gros plan (500 meubles empilés) → pas de débordement de pile', () => {
    const room = { id: 'a', type: 'autre' as const, name: 'A', rect: { x: 500, y: 500, w: 600, h: 400 } };
    const furniture = Array.from({ length: 500 }, (_, i) => ({ id: `f${i}`, catalogId: 'x', label: `M${i}`, x: 510, y: 510, w: 50, d: 50, rotation: 0 as const }));
    const plan: Plan = { levels: [{ id: 'rdc', rooms: [room], openings: [], furniture }], stairs: null };
    const v = validatePlan(site, DEFAULT_RULE_PARAMS, plan);
    expect(v.filter((x) => x.code === 'FURNITURE_OVERLAP')).toHaveLength((500 * 499) / 2);
  });

  it('erreurs avant alertes : FOOTPRINT_NEAR_MAX (émis en premier) passe après ROOM_OVERLAP', () => {
    // Terrain 2000×3000 = 600 m² ; emprise ≈ 37,5 % (≥ 36 %, ≤ 40 %) avec deux pièces qui se chevauchent.
    const rooms = [
      { id: 'a', type: 'autre' as const, name: 'A', rect: { x: 500, y: 500, w: 1000, h: 1200 } },
      { id: 'b', type: 'autre' as const, name: 'B', rect: { x: 500, y: 1600, w: 700, h: 1500 } },
    ];
    const plan: Plan = { levels: [{ id: 'rdc', rooms, openings: [], furniture: [] }], stairs: null };
    const codes = validatePlan(site, DEFAULT_RULE_PARAMS, plan).map((v) => v.code);
    expect(codes).toContain('FOOTPRINT_NEAR_MAX');
    expect(codes.indexOf('ROOM_OVERLAP')).toBeGreaterThanOrEqual(0);
    expect(codes.indexOf('ROOM_OVERLAP')).toBeLessThan(codes.indexOf('FOOTPRINT_NEAR_MAX'));
  });
});
