import type { Furniture, Point, Rect } from './types';

export const area = (r: Rect): number => r.w * r.h;

export function intersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

export const overlaps = (a: Rect, b: Rect): boolean => intersection(a, b) !== null;

export const containsRect = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

export function furnitureFootprint(f: Furniture): Rect {
  const swap = f.rotation === 90 || f.rotation === 270;
  return { x: f.x, y: f.y, w: swap ? f.d : f.w, h: swap ? f.w : f.d };
}

export const corners = (r: Rect): Point[] => [
  { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
];

export function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function onSegment(p: Point, a: Point, b: Point): boolean {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  return cross === 0 &&
    p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) &&
    p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
}

// Polygone simple quelconque ; points sur le bord comptés comme dedans.
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (onSegment(p, a, b)) return true;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Les 4 coins dans le polygone : suffisant seulement pour un polygone convexe.
export const rectInPolygon = (r: Rect, poly: Point[]): boolean =>
  corners(r).every((c) => pointInPolygon(c, poly));

export function distancePointToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const orient = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const o1 = orient(p1, p2, p3), o2 = orient(p1, p2, p4), o3 = orient(p3, p4, p1), o4 = orient(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  return onSegment(p3, p1, p2) || onSegment(p4, p1, p2) || onSegment(p1, p3, p4) || onSegment(p2, p3, p4);
}

export function distanceRectToSegment(r: Rect, a: Point, b: Point): number {
  if (distancePointToRect(a, r) === 0 || distancePointToRect(b, r) === 0) return 0;
  const cs = corners(r);
  for (let i = 0; i < 4; i++) {
    if (segmentsIntersect(a, b, cs[i]!, cs[(i + 1) % 4]!)) return 0;
  }
  return Math.min(
    ...cs.map((c) => distancePointToSegment(c, a, b)),
    distancePointToRect(a, r),
    distancePointToRect(b, r),
  );
}

export function coveredByUnion(r: Rect, rects: Rect[]): boolean {
  const clipped = rects.map((q) => intersection(r, q)).filter((q): q is Rect => q !== null);
  const xs = [...new Set([r.x, r.x + r.w, ...clipped.flatMap((q) => [q.x, q.x + q.w])])].sort((m, n) => m - n);
  const ys = [...new Set([r.y, r.y + r.h, ...clipped.flatMap((q) => [q.y, q.y + q.h])])].sort((m, n) => m - n);
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i]! + xs[i + 1]!) / 2;
      const cy = (ys[j]! + ys[j + 1]!) / 2;
      if (!clipped.some((q) => cx > q.x && cx < q.x + q.w && cy > q.y && cy < q.y + q.h)) return false;
    }
  }
  return true;
}
