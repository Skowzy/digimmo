import type { RuleParams, Site } from '@digimmo/domain';
import type { Project } from './project.entity';

/** Seul endroit qui traduit un projet stocké en terrain + règles du domaine (validation et réponses API). */
export function siteAndRules(p: Project): { site: Site; rules: RuleParams } {
  return {
    site: { boundary: p.terrainPolygon, streetEdge: p.streetEdge },
    rules: {
      setbackStreetCm: p.setbackStreetCm,
      setbackSidesCm: p.setbackSidesCm,
      maxFootprintPct: p.maxFootprintPct,
      minAreasM2: p.minAreasM2,
    },
  };
}
