import { distanceRectToSegment, area, rectInPolygon } from '../geometry';
import type { Point, Room, RuleParams, Site, Violation } from '../types';
import { formatMeters } from '../units';

const polygonArea = (poly: Point[]): number => {
  let s = 0;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    s += p.x * q.y - q.x * p.y;
  });
  return Math.abs(s) / 2;
};

const comma = (n: string | number): string => String(n).replace('.', ',');

export function checkSite(site: Site, params: RuleParams, rdcRooms: Room[]): Violation[] {
  const out: Violation[] = [];
  const n = site.boundary.length;
  for (const room of rdcRooms) {
    if (!rectInPolygon(room.rect, site.boundary)) {
      out.push({ code: 'HOUSE_OUTSIDE_SITE', severity: 'error', message: `La pièce « ${room.name} » dépasse du terrain.`, refs: [room.id], level: 'rdc' });
    }
    const edge = (i: number): number =>
      distanceRectToSegment(room.rect, site.boundary[i]!, site.boundary[(i + 1) % n]!);
    const dStreet = edge(site.streetEdge);
    if (dStreet < params.setbackStreetCm) {
      out.push({ code: 'SETBACK_STREET', severity: 'error', message: `« ${room.name} » est à ${formatMeters(dStreet)} de la voie (minimum ${formatMeters(params.setbackStreetCm)}).`, refs: [room.id], level: 'rdc' });
    }
    let dSide = Infinity;
    for (let i = 0; i < n; i++) if (i !== site.streetEdge) dSide = Math.min(dSide, edge(i));
    if (dSide < params.setbackSidesCm) {
      out.push({ code: 'SETBACK_SIDES', severity: 'error', message: `« ${room.name} » est à ${formatMeters(dSide)} d'une limite séparative (minimum ${formatMeters(params.setbackSidesCm)}).`, refs: [room.id], level: 'rdc' });
    }
  }
  const siteArea = polygonArea(site.boundary);
  if (siteArea > 0) {
    const pct = (rdcRooms.reduce((s, r) => s + area(r.rect), 0) / siteArea) * 100;
    const pctStr = comma(pct.toFixed(1));
    const max = comma(params.maxFootprintPct);
    if (pct > params.maxFootprintPct) {
      out.push({ code: 'FOOTPRINT_MAX', severity: 'error', message: `Emprise au sol de ${pctStr} % : le maximum est ${max} %.`, refs: [], level: 'rdc' });
    } else if (pct >= 0.9 * params.maxFootprintPct) {
      out.push({ code: 'FOOTPRINT_NEAR_MAX', severity: 'warning', message: `Emprise au sol à ${pctStr} % : proche du maximum de ${max} %.`, refs: [], level: 'rdc' });
    }
  }
  return out;
}
