import { distancePointToRect, furnitureFootprint, intersection } from '../geometry';
import type { Level, Opening, Point, Rect, Violation } from '../types';
import { computeWallSegments, findSegmentFor } from '../walls';

export function doorHinge(o: Opening): Point {
  const along = o.swing?.hinge === 'end' ? o.start + o.width : o.start;
  return o.orientation === 'h' ? { x: along, y: o.fixed } : { x: o.fixed, y: along };
}

export function doorSwingRect(o: Opening): Rect {
  const w = o.width;
  const off = o.swing?.side === 'neg' ? o.fixed - w : o.fixed;
  return o.orientation === 'h' ? { x: o.start, y: off, w, h: w } : { x: off, y: o.start, w, h: w };
}

export function checkOpenings(level: Level): Violation[] {
  const out: Violation[] = [];
  const segments = computeWallSegments(level.rooms);
  const placed: Opening[] = [];
  const v = (code: Violation['code'], message: string, refs: string[]): Violation =>
    ({ code, severity: 'error', message, refs, level: level.id });

  for (const o of level.openings) {
    const seg = findSegmentFor(o, segments);
    if (!seg) { out.push(v('OPENING_NOT_ON_WALL', 'Une ouverture n\'est sur aucun mur.', [o.id])); continue; }
    placed.push(o);
    if (o.kind === 'window' && !seg.exterior) {
      out.push(v('WINDOW_ON_INTERIOR_WALL', 'Une fenêtre doit être sur un mur extérieur.', [o.id]));
    }
  }

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!, b = placed[j]!;
      if (a.orientation !== b.orientation || a.fixed !== b.fixed) continue;
      if (Math.min(a.start + a.width, b.start + b.width) - Math.max(a.start, b.start) > 0) {
        out.push(v('OPENING_OVERLAP', 'Deux ouvertures se chevauchent sur le même mur.', [a.id, b.id]));
      }
    }
  }

  for (const o of placed) {
    if (o.kind !== 'door' || !o.swing) continue;
    const square = doorSwingRect(o);
    const hinge = doorHinge(o);
    for (const f of level.furniture) {
      const hit = intersection(furnitureFootprint(f), square);
      if (hit && distancePointToRect(hinge, hit) < o.width) {
        out.push(v('DOOR_BLOCKED', `« ${f.label} » gêne l'ouverture d'une porte.`, [o.id, f.id]));
      }
    }
  }
  return out;
}
