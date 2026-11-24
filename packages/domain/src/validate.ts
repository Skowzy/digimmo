import { checkFurniture, checkStairs } from './rules/furniture';
import { checkOpenings } from './rules/openings';
import { checkRoomAreas, checkRoomOverlaps, checkUpperSupported } from './rules/rooms';
import { checkSite } from './rules/site';
import type { Plan, RuleParams, Site, Violation } from './types';

/** Au-delà, la liste est coupée : elle doit tenir dans une réponse d'API et un document MongoDB (16 Mo). */
export const MAX_VIOLATIONS = 200;

/** Évalue toutes les règles ; erreurs avant alertes (tri stable), au plus MAX_VIOLATIONS + 1 résumé. */
export function validatePlan(site: Site, params: RuleParams, plan: Plan): Violation[] {
  const rdc = plan.levels.find((l) => l.id === 'rdc');
  const r1 = plan.levels.find((l) => l.id === 'r1');
  let out: Violation[] = checkSite(site, params, rdc?.rooms ?? []);
  for (const level of plan.levels) {
    // Pas de push(...spread) : un grand tableau dépasserait la limite de pile.
    out = out.concat(
      checkRoomOverlaps(level),
      checkRoomAreas(level, params),
      checkOpenings(level),
      checkFurniture(level, r1 ? (plan.stairs?.rect ?? null) : null),
    );
  }
  if (rdc && r1) out = out.concat(checkUpperSupported(rdc, r1));
  out = out.concat(checkStairs(plan));
  const rank = (v: Violation) => (v.severity === 'error' ? 0 : 1);
  out.sort((a, b) => rank(a) - rank(b));
  if (out.length <= MAX_VIOLATIONS) return out;
  const rest = out.length - MAX_VIOLATIONS;
  return [...out.slice(0, MAX_VIOLATIONS),
    { code: 'TOO_MANY_VIOLATIONS', severity: 'warning', message: `… et ${rest} autres problèmes.`, refs: [] }];
}
