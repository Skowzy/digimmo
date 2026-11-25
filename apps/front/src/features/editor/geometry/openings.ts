import type { Opening, Point, Room, WallSegment } from '@digimmo/domain'
import { snapValue } from './snap'

export const LARGEUR_DEFAUT = { door: 90, window: 120 } as const
export const LARGEUR_MIN = 30
export const LARGEUR_MAX = 500
export const MAX_OUVERTURES = 200

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
/** Position le long du mur (x pour un mur horizontal, y sinon). */
export const along = (o: { orientation: 'h' | 'v' }, p: Point) => (o.orientation === 'h' ? p.x : p.y)
const perp = (o: { orientation: 'h' | 'v' }, p: Point) => (o.orientation === 'h' ? p.y : p.x)

/** Distance d'un point à un segment de mur. */
export function distanceSegment(s: WallSegment, p: Point): number {
  const d = clamp(along(s, p), s.start, s.end) - along(s, p)
  return Math.hypot(d, perp(s, p) - s.fixed)
}

/** Segment le plus proche du point, dans le seuil (cm), sinon null. */
export function segmentProche(segments: WallSegment[], p: Point, seuil: number): WallSegment | null {
  let best: WallSegment | null = null
  let bestD = Infinity
  for (const s of segments) {
    const d = distanceSegment(s, p)
    if (d <= seuil && d < bestD) { best = s; bestD = d }
  }
  return best
}

/** Bornes de `start` : le segment porteur, sinon le repère entier. */
export const bornesStart = (width: number, seg: WallSegment | null, max = 100_000): [number, number] =>
  seg ? [seg.start, seg.end - width] : [0, max - width]

/** Ouverture centrée sur le point cliqué, ou null si le mur est trop court. */
export function ouvertureCliquee(
  kind: 'door' | 'window', seg: WallSegment, p: Point, rooms: Room[], id: string,
): Opening | null {
  const longueur = seg.end - seg.start
  if (longueur < LARGEUR_MIN) return null
  const width = Math.min(LARGEUR_DEFAUT[kind], longueur)
  const [min, max] = bornesStart(width, seg)
  const start = clamp(snapValue(along(seg, p) - width / 2), min, max)
  const base = { id, kind, orientation: seg.orientation, fixed: seg.fixed, start, width }
  if (kind === 'window') return base
  let side: 'neg' | 'pos'
  const decalage = perp(seg, p) - seg.fixed
  if (seg.exterior) {
    const room = rooms.find((r) => r.id === seg.roomIds[0])
    const centre = room ? (seg.orientation === 'h' ? room.rect.y + room.rect.h / 2 : room.rect.x + room.rect.w / 2) : seg.fixed
    side = centre < seg.fixed ? 'neg' : 'pos'
  } else side = decalage < 0 ? 'neg' : 'pos'
  return { ...base, swing: { hinge: 'start', side } }
}
