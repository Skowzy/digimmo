import { area, coveredByUnion, overlaps } from '../geometry';
import type { Level, RuleParams, Violation } from '../types';
import { formatArea } from '../units';

export function checkRoomOverlaps(level: Level): Violation[] {
  const out: Violation[] = [];
  const rooms = level.rooms;
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]!;
      const b = rooms[j]!;
      if (overlaps(a.rect, b.rect)) {
        out.push({ code: 'ROOM_OVERLAP', severity: 'error', message: `« ${a.name} » et « ${b.name} » se chevauchent.`, refs: [a.id, b.id], level: level.id });
      }
    }
  }
  return out;
}

export function checkRoomAreas(level: Level, params: RuleParams): Violation[] {
  const out: Violation[] = [];
  for (const room of level.rooms) {
    const minM2 = params.minAreasM2[room.type];
    if (minM2 === undefined) continue;
    const minCm2 = Math.round(minM2 * 10_000);
    const a = area(room.rect);
    if (a < minCm2) {
      out.push({ code: 'ROOM_MIN_AREA', severity: 'error', message: `« ${room.name} » fait ${formatArea(a)} : minimum ${formatArea(minCm2)} pour ce type de pièce.`, refs: [room.id], level: level.id });
    }
  }
  return out;
}

export function checkUpperSupported(rdc: Level, r1: Level): Violation[] {
  const base = rdc.rooms.map((r) => r.rect);
  return r1.rooms
    .filter((room) => !coveredByUnion(room.rect, base))
    .map((room) => ({ code: 'UPPER_NOT_SUPPORTED' as const, severity: 'error' as const, message: `« ${room.name} » (étage) n'est pas au-dessus du rez-de-chaussée.`, refs: [room.id], level: r1.id }));
}
