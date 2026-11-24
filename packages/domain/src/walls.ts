import type { Cm, Opening, Orientation, Room } from './types';

export interface WallSegment {
  orientation: Orientation; fixed: Cm; start: Cm; end: Cm; roomIds: string[]; exterior: boolean;
}

interface Side { orientation: Orientation; fixed: Cm; a: Cm; b: Cm; idx: number; id: string }

export function computeWallSegments(rooms: Room[]): WallSegment[] {
  const groups = new Map<string, Side[]>();
  rooms.forEach((r, idx) => {
    const { x, y, w, h } = r.rect;
    const sides: Side[] = [
      { orientation: 'h', fixed: y, a: x, b: x + w, idx, id: r.id },
      { orientation: 'h', fixed: y + h, a: x, b: x + w, idx, id: r.id },
      { orientation: 'v', fixed: x, a: y, b: y + h, idx, id: r.id },
      { orientation: 'v', fixed: x + w, a: y, b: y + h, idx, id: r.id },
    ];
    for (const s of sides) {
      const k = `${s.orientation}:${s.fixed}`;
      const g = groups.get(k);
      if (g) g.push(s); else groups.set(k, [s]);
    }
  });

  const out: WallSegment[] = [];
  for (const sides of groups.values()) {
    const first = sides[0]!;
    const cuts = [...new Set(sides.flatMap(s => [s.a, s.b]))].sort((p, q) => p - q);
    const line: WallSegment[] = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const p = cuts[i]!, q = cuts[i + 1]!;
      const ids = [...new Map(sides.filter(s => s.a <= p && s.b >= q).sort((s, t) => s.idx - t.idx).map(s => [s.id, s])).keys()];
      if (ids.length === 0) continue;
      const prev = line[line.length - 1];
      if (prev && prev.end === p && prev.roomIds.join() === ids.join()) prev.end = q;
      else line.push({ orientation: first.orientation, fixed: first.fixed, start: p, end: q, roomIds: ids, exterior: ids.length === 1 });
    }
    for (const seg of line) out.push(seg);
  }
  return out.sort((s, t) =>
    (s.orientation === t.orientation ? 0 : s.orientation === 'h' ? -1 : 1) || s.fixed - t.fixed || s.start - t.start);
}

export function findSegmentFor(opening: Opening, segments: WallSegment[]): WallSegment | null {
  const end = opening.start + opening.width;
  return segments.find(s => s.orientation === opening.orientation && s.fixed === opening.fixed
    && s.start <= opening.start && s.end >= end) ?? null;
}
