import { describe, expect, it } from 'vitest'
import { rectangularSite } from '@digimmo/domain'
import { parseDecimal, parseMeters, siteToTerrain } from './units'

describe('parseMeters', () => {
  it.each([['20,5', 2050], ['20.5', 2050], [' 20,50 ', 2050], ['20', 2000], ['0,07', 7]])('%s => %s', (entree, cm) => {
    expect(parseMeters(entree)).toBe(cm)
  })
  it.each(['abc', '-3', '0', '', '1,234', '1,2,3', '0,00'])('%j => null', (entree) => {
    expect(parseMeters(entree)).toBeNull()
  })
})

describe('parseDecimal', () => {
  it('accepte virgule ou point', () => {
    expect(parseDecimal('37,5', 2)).toBe(37.5)
    expect(parseDecimal('0', 2)).toBe(0)
    expect(parseDecimal('9', 0)).toBe(9)
  })
  it('refuse trop de décimales ou le non numérique', () => {
    expect(parseDecimal('1,234', 2)).toBeNull()
    expect(parseDecimal('9,5', 0)).toBeNull()
    expect(parseDecimal('x', 2)).toBeNull()
    expect(parseDecimal('-1', 2)).toBeNull()
  })
})

describe('siteToTerrain', () => {
  it('retrouve largeur, profondeur et côté de voie', () => {
    expect(siteToTerrain(rectangularSite(2000, 3000, 'south'))).toEqual({ widthCm: 2000, depthCm: 3000, street: 'south' })
    expect(siteToTerrain(rectangularSite(1500, 800, 'west'))).toEqual({ widthCm: 1500, depthCm: 800, street: 'west' })
  })
  it('null si non rectangulaire', () => {
    expect(siteToTerrain({ boundary: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 500, y: 800 }], streetEdge: 0 })).toBeNull()
    expect(siteToTerrain({ boundary: [{ x: 0, y: 0 }, { x: 1000, y: 100 }, { x: 1000, y: 800 }, { x: 0, y: 800 }], streetEdge: 0 })).toBeNull()
  })
})
