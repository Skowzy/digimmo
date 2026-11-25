import type { Point } from '@digimmo/domain'

/** Aire (formule du lacet) d'un polygone, en cm². */
export function polygonArea(points: Point[]): number {
  let somme = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    somme += a.x * b.y - b.x * a.y
  }
  return Math.abs(somme) / 2
}
