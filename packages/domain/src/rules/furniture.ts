import { containsRect, furnitureFootprint, overlaps } from '../geometry';
import type { Level, Plan, Rect, Violation } from '../types';

export function checkFurniture(level: Level, stairs: Rect | null): Violation[] {
  const out: Violation[] = [];
  const items = level.furniture.map((f) => ({ f, r: furnitureFootprint(f) }));
  for (const { f, r } of items) {
    const inRooms = level.rooms.filter((room) => containsRect(room.rect, r)).length;
    if (inRooms !== 1) {
      out.push({ code: 'FURNITURE_OUTSIDE_ROOM', severity: 'error', message: `« ${f.label} » doit être entièrement dans une pièce.`, refs: [f.id], level: level.id });
    }
  }
  for (let i = 0; i < items.length; i++) {
    const a = items[i]!;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j]!;
      if (overlaps(a.r, b.r)) {
        out.push({ code: 'FURNITURE_OVERLAP', severity: 'error', message: `Chevauchement : ${a.f.label} / ${b.f.label}.`, refs: [a.f.id, b.f.id], level: level.id });
      }
    }
    if (stairs && overlaps(a.r, stairs)) {
      out.push({ code: 'FURNITURE_OVERLAP', severity: 'error', message: `Chevauchement : ${a.f.label} / escalier.`, refs: [a.f.id, 'stairs'], level: level.id });
    }
  }
  return out;
}

export function checkStairs(plan: Plan): Violation[] {
  const rdc = plan.levels.find((l) => l.id === 'rdc');
  const r1 = plan.levels.find((l) => l.id === 'r1');
  if (!r1) return [];
  if (!plan.stairs) {
    return [{ code: 'STAIRS_MISSING', severity: 'warning', message: "Il y a un étage mais pas d'escalier.", refs: [] }];
  }
  const rect = plan.stairs.rect;
  const inOneRoom = (l: Level | undefined) => !!l && l.rooms.filter((room) => containsRect(room.rect, rect)).length === 1;
  if (inOneRoom(rdc) && inOneRoom(r1)) return [];
  return [{ code: 'STAIRS_PLACEMENT', severity: 'error', message: "L'escalier doit être dans une pièce, au rez-de-chaussée comme à l'étage.", refs: ['stairs'] }];
}
