import { checkFurniture, checkStairs } from './rules/furniture';
import { checkOpenings } from './rules/openings';
import { checkRoomAreas, checkRoomOverlaps, checkUpperSupported } from './rules/rooms';
import { checkSite } from './rules/site';
import type { Plan, RuleParams, Site, Violation } from './types';

/** Évalue toutes les règles ; erreurs avant alertes (tri stable). */
export function validatePlan(site: Site, params: RuleParams, plan: Plan): Violation[] {
  const rdc = plan.levels.find((l) => l.id === 'rdc');
  const r1 = plan.levels.find((l) => l.id === 'r1');
  const out: Violation[] = [...checkSite(site, params, rdc?.rooms ?? [])];
  for (const level of plan.levels) {
    out.push(
      ...checkRoomOverlaps(level),
      ...checkRoomAreas(level, params),
      ...checkOpenings(level),
      ...checkFurniture(level, r1 ? (plan.stairs?.rect ?? null) : null),
    );
  }
  if (rdc && r1) out.push(...checkUpperSupported(rdc, r1));
  out.push(...checkStairs(plan));
  const rank = (v: Violation) => (v.severity === 'error' ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b));
}
