import type { Rect } from '@digimmo/domain'

/** Borne du repère du domaine : toutes les coordonnées et dimensions sont dans [0, 100000] cm. */
export const MAX_CM = 100_000

const borne = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(max, min))

/** Ramène le rectangle dans le repère en conservant sa taille (réduite seulement si elle dépasse le repère). */
export function clampRect(r: Rect): Rect {
  const w = borne(r.w, 1, MAX_CM)
  const h = borne(r.h, 1, MAX_CM)
  return { x: borne(r.x, 0, MAX_CM - w), y: borne(r.y, 0, MAX_CM - h), w, h }
}

/** Le rectangle tient-il entièrement dans le repère [0, MAX_CM] ? */
export const fitsRepere = (r: Rect): boolean =>
  r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.x + r.w <= MAX_CM && r.y + r.h <= MAX_CM

/** Borne une translation (dx, dy) pour que chacun des rectangles reste dans le repère. */
export function clampTranslation(rects: Rect[], dx: number, dy: number): { dx: number; dy: number } {
  let [minX, maxX, minY, maxY] = [-Infinity, Infinity, -Infinity, Infinity]
  for (const r of rects) {
    minX = Math.max(minX, 0 - r.x)
    maxX = Math.min(maxX, MAX_CM - (r.x + r.w))
    minY = Math.max(minY, 0 - r.y)
    maxY = Math.min(maxY, MAX_CM - (r.y + r.h))
  }
  return { dx: borne(dx, minX, maxX), dy: borne(dy, minY, maxY) }
}

/** Borne une valeur scalaire de [0, max]. */
export const bornerValeur = (v: number, max: number = MAX_CM) => borne(v, 0, max)
