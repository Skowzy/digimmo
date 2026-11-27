import { describe, expect, it } from 'vitest'
import { clampRect, clampTranslation, fitsRepere, MAX_CM } from './bounds'

describe('bounds', () => {
  it('clampRect ramène le rectangle dans le repère en gardant sa taille', () => {
    expect(clampRect({ x: 99_800, y: -5, w: 400, h: 300 })).toEqual({ x: 99_600, y: 0, w: 400, h: 300 })
  })
  it('clampRect réduit une taille supérieure au repère', () => {
    expect(clampRect({ x: 10, y: 10, w: 200_000, h: 0 })).toEqual({ x: 0, y: 10, w: MAX_CM, h: 1 })
  })
  it('fitsRepere', () => {
    expect(fitsRepere({ x: 99_600, y: 0, w: 400, h: 300 })).toBe(true)
    expect(fitsRepere({ x: 99_601, y: 0, w: 400, h: 300 })).toBe(false)
    expect(fitsRepere({ x: -1, y: 0, w: 10, h: 10 })).toBe(false)
  })
  it('clampTranslation borne selon le rectangle le plus contraignant', () => {
    const rects = [{ x: 0, y: 0, w: 400, h: 300 }, { x: 50, y: 50, w: 100, h: 80 }]
    expect(clampTranslation(rects, 200_000, 20)).toEqual({ dx: 99_600, dy: 20 })
    expect(clampTranslation(rects, -30, -30)).toEqual({ dx: 0, dy: 0 })
  })
  it('clampTranslation sans rectangle laisse la translation intacte', () => {
    expect(clampTranslation([], 5, -7)).toEqual({ dx: 5, dy: -7 })
  })
})
