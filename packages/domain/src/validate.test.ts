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
});
