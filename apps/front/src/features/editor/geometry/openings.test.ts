import { describe, expect, it } from 'vitest'
import type { Room, WallSegment } from '@digimmo/domain'
import { ouvertureCliquee } from './openings'

const room = (id: string, x: number, y: number, w: number, h: number): Room => ({ id, type: 'autre', name: id, rect: { x, y, w, h } })
const cote = (seg: WallSegment, x: number, y: number, rooms: Room[]) => ouvertureCliquee('door', seg, { x, y }, rooms, 'o1')!.swing!.side

describe('côté d\'ouverture d\'une porte', () => {
  const hInt: WallSegment = { orientation: 'h', fixed: 900, start: 300, end: 900, roomIds: ['a', 'b'], exterior: false }
  const vInt: WallSegment = { orientation: 'v', fixed: 900, start: 300, end: 900, roomIds: ['a', 'b'], exterior: false }
  it('mur horizontal intérieur : selon le côté du clic', () => {
    expect(cote(hInt, 600, 895, [])).toBe('neg')
    expect(cote(hInt, 600, 905, [])).toBe('pos')
  })
  it('mur vertical intérieur : selon le côté du clic', () => {
    expect(cote(vInt, 895, 600, [])).toBe('neg')
    expect(cote(vInt, 905, 600, [])).toBe('pos')
  })
  it('mur vertical extérieur, pièce du côté bas : neg ; du côté haut : pos', () => {
    const gauche = room('a', 300, 300, 600, 600) // mur x = 900 à sa droite, pièce côté x plus petit
    const droite = room('b', 900, 300, 600, 600) // mur x = 900 à sa gauche
    const seg = (id: string): WallSegment => ({ orientation: 'v', fixed: 900, start: 300, end: 900, roomIds: [id], exterior: true })
    expect(cote(seg('a'), 900, 600, [gauche])).toBe('neg')
    expect(cote(seg('b'), 900, 600, [droite])).toBe('pos')
  })
})
