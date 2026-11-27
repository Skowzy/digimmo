import { describe, expect, it } from 'vitest'
import { snapValue, snapRect, snapResize, screenThreshold } from './snap'
import { nextRoomName } from './ids'

const voisin = { x: 0, y: 0, w: 300, h: 200 }

describe('snapValue', () => {
  it('arrondit à 10 cm', () => {
    expect(snapValue(14)).toBe(10)
    expect(snapValue(15)).toBe(20)
    expect(snapValue(-4)).toBe(0)
  })
})

describe('snapRect', () => {
  it('colle bord à bord à 6 cm avec seuil 8', () => {
    const r = snapRect({ x: 306, y: 0, w: 100, h: 100 }, [voisin], 8)
    expect(r.x).toBe(300)
    expect(r.w).toBe(100)
    expect(r.h).toBe(100)
  })
  it('aligne sur la grille à 12 cm', () => {
    const r = snapRect({ x: 312, y: 0, w: 101, h: 100 }, [voisin], 8)
    expect(r.x).toBe(310)
    expect(r.w).toBe(101)
  })
  it('aligne le bord droit sur le bord gauche voisin', () => {
    const r = snapRect({ x: -105, y: 500, w: 100, h: 100 }, [voisin], 8)
    expect(r.x).toBe(-100)
  })
})

describe('snapResize', () => {
  it('colle le bord e au bord gauche d’un voisin à 3 cm', () => {
    const r = snapResize({ x: -400, y: 0, w: 200, h: 100 }, 'e', { x: -3, y: 50 }, [{ x: 0, y: 0, w: 100, h: 100 }], 8)
    expect(r.x + r.w).toBe(0)
    expect(r.x).toBe(-400)
  })
  it('respecte la taille minimale sans retourner le rectangle', () => {
    const r = snapResize({ x: 0, y: 0, w: 200, h: 100 }, 'e', { x: -300, y: 50 }, [], 8)
    expect(r.w).toBe(50)
    expect(r.x).toBe(0)
    const w = snapResize({ x: 0, y: 0, w: 200, h: 100 }, 'nw', { x: 500, y: 500 }, [], 8)
    expect(w).toEqual({ x: 150, y: 50, w: 50, h: 50 })
  })
})

describe('screenThreshold', () => {
  it('convertit 8 px en cm', () => {
    expect(screenThreshold({ x: 0, y: 0, width: 1000, height: 500 }, 500)).toBe(16)
  })
})

describe('nextRoomName', () => {
  it('prend le premier numéro libre', () => {
    const room = (name: string) => ({ id: name, type: 'other', name, rect: voisin }) as never
    expect(nextRoomName([room('Pièce 1'), room('Pièce 3')])).toBe('Pièce 2')
  })
})
