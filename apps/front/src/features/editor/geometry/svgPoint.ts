import type { Point } from '@digimmo/domain'

/**
 * Convertit des coordonnées écran en cm du plan (arrondi au cm).
 * Si `getScreenCTM()` est indisponible (null), renvoie le point client arrondi, non converti.
 */
export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: Math.round(clientX), y: Math.round(clientY) }
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const p = pt.matrixTransform(ctm.inverse())
  return { x: Math.round(p.x), y: Math.round(p.y) }
}
