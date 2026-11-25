import type { Point, Rect } from '@digimmo/domain'
import type { View } from '../state/types'

export const GRID_CM = 10

/** Arrondit au multiple de 10 cm le plus proche. */
export function snapValue(v: number): number {
  const r = Math.round(v / GRID_CM) * GRID_CM
  return r === 0 ? 0 : r // évite -0
}

/** Meilleur bord cible (plus petit |delta| ≤ seuil) pour un ensemble de bords mobiles, ou null. */
function bestDelta(moving: number[], targets: number[], threshold: number): number | null {
  let best: number | null = null
  for (const m of moving) {
    for (const t of targets) {
      const d = t - m
      if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d
    }
  }
  return best
}

/** Aimante un rectangle déplacé sur les bords des autres, sinon sur la grille. Taille conservée. */
export function snapRect(rect: Rect, others: Rect[], thresholdCm: number): Rect {
  const dx = bestDelta(
    [rect.x, rect.x + rect.w],
    others.flatMap((o) => [o.x, o.x + o.w]),
    thresholdCm,
  )
  const dy = bestDelta(
    [rect.y, rect.y + rect.h],
    others.flatMap((o) => [o.y, o.y + o.h]),
    thresholdCm,
  )
  return {
    x: Math.round(dx === null ? snapValue(rect.x) : rect.x + dx),
    y: Math.round(dy === null ? snapValue(rect.y) : rect.y + dy),
    w: rect.w,
    h: rect.h,
  }
}

/** Valeur aimantée sur le bord parallèle le plus proche (dans le seuil), sinon sur la grille. */
function snapEdge(v: number, targets: number[], threshold: number): number {
  const d = bestDelta([v], targets, threshold)
  return Math.round(d === null ? snapValue(v) : v + d)
}

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** Redimensionne : les bords tirés suivent `point` (aimanté), l'opposé reste fixe, taille ≥ minCm. */
export function snapResize(
  rect: Rect,
  edge: ResizeEdge,
  point: Point,
  others: Rect[],
  thresholdCm: number,
  minCm = 50,
): Rect {
  let left = rect.x
  let right = rect.x + rect.w
  let top = rect.y
  let bottom = rect.y + rect.h
  const xs = others.flatMap((o) => [o.x, o.x + o.w])
  const ys = others.flatMap((o) => [o.y, o.y + o.h])
  if (edge.includes('w')) left = Math.min(snapEdge(point.x, xs, thresholdCm), right - minCm)
  if (edge.includes('e')) right = Math.max(snapEdge(point.x, xs, thresholdCm), left + minCm)
  if (edge.includes('n')) top = Math.min(snapEdge(point.y, ys, thresholdCm), bottom - minCm)
  if (edge.includes('s')) bottom = Math.max(snapEdge(point.y, ys, thresholdCm), top + minCm)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

/** Convertit `px` pixels écran en cm selon le zoom courant. */
export function screenThreshold(view: View, svgWidthPx: number, px = 8): number {
  return svgWidthPx > 0 ? (px * view.width) / svgWidthPx : 0
}
