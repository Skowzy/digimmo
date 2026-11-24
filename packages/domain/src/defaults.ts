import type { Cm, RuleParams, Site } from './types';

/** Valeurs indicatives, choix du concepteur. */
export const DEFAULT_RULE_PARAMS: RuleParams = {
  setbackStreetCm: 500,
  setbackSidesCm: 300,
  maxFootprintPct: 40,
  minAreasM2: { chambre: 9, sejour: 16, cuisine: 6, sdb: 3, wc: 1 },
};

const STREET_EDGE = { north: 0, east: 1, south: 2, west: 3 } as const;

/** Parcelle rectangulaire ; sommets horaires à partir de (0,0). */
export function rectangularSite(widthCm: Cm, depthCm: Cm, street: 'north' | 'south' | 'east' | 'west'): Site {
  return {
    boundary: [
      { x: 0, y: 0 },
      { x: widthCm, y: 0 },
      { x: widthCm, y: depthCm },
      { x: 0, y: depthCm },
    ],
    streetEdge: STREET_EDGE[street],
  };
}
