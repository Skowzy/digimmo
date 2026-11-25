import { describe, expect, it } from 'vitest'
import { polygonArea } from './geometry'

describe('polygonArea', () => {
  it('rectangle 2000×3000 = 6 000 000 cm²', () => {
    const r = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 3000 }, { x: 0, y: 3000 }]
    expect(polygonArea(r)).toBe(6_000_000)
  })
  it('indépendant du sens et du décalage', () => {
    const t = [{ x: 100, y: 100 }, { x: 100, y: 500 }, { x: 400, y: 100 }]
    expect(polygonArea(t)).toBe(60_000)
  })
  it('moins de 3 points = 0', () => {
    expect(polygonArea([{ x: 1, y: 1 }])).toBe(0)
  })
})
