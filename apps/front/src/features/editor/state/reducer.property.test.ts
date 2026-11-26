import { describe, expect, it } from 'vitest'
import { parsePlan, rectangularSite, type Plan, type RoomType } from '@digimmo/domain'
import { currentLevel, editorReducer, initEditor, type Action } from './reducer'
import type { EditorState } from './types'

/** Générateur congruentiel linéaire (graine fixée) : pas de dépendance. */
function lcg(seed: number) {
  let s = seed >>> 0
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 }
  return {
    next,
    int: (a: number, b: number) => a + Math.floor(next() * (b - a + 1)),
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
  }
}

const TYPES: RoomType[] = ['sejour', 'cuisine', 'chambre', 'sdb', 'wc', 'entree', 'degagement', 'garage', 'autre']
const BORDS = [0, 1, 50, 99_000, 99_950, 100_000]

describe('réducteur : propriété « le plan reste valide »', () => {
  it('200 séquences de 60 actions aléatoires donnent toujours un plan accepté par parsePlan', () => {
    for (let run = 0; run < 200; run++) {
      const r = lcg(run + 1)
      let n = 0
      const id = (p: string) => `${p}${++n}`
      const coord = () => (r.next() < 0.3 ? r.pick(BORDS) : r.int(0, 100_000))
      const dim = () => (r.next() < 0.3 ? r.pick(BORDS.filter((v) => v > 0)) : r.int(1, 2_000))
      const rect = () => ({ x: coord(), y: coord(), w: dim(), h: dim() })
      let s: EditorState = initEditor({ levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }], stairs: null }, rectangularSite(2000, 3000, 'south'))

      const tous = () => {
        const l = currentLevel(s)
        return { rooms: l.rooms, openings: l.openings, furniture: l.furniture }
      }
      const action = (): Action => {
        const { rooms, openings, furniture } = tous()
        const k = r.int(0, 15)
        switch (k) {
          case 0: case 1: return { type: 'addRoom', room: { id: id('r'), type: r.pick(TYPES), name: 'Pièce', rect: rect() } }
          case 2: case 3: {
            const x = rooms.length ? r.pick(rooms) : undefined
            if (!x) return { type: 'undo' }
            const changes = r.next() < 0.6 ? { rect: { ...x.rect, x: coord(), y: coord() } } : { rect: rect() }
            return { type: 'updateRoom', id: x.id, changes }
          }
          case 4: {
            const kind = r.pick(['door', 'window'] as const)
            return { type: 'addOpening', opening: {
              id: id('o'), kind, orientation: r.pick(['h', 'v'] as const), fixed: coord(), start: coord(), width: r.int(30, 500),
              ...(kind === 'door' ? { swing: { hinge: r.pick(['start', 'end'] as const), side: r.pick(['neg', 'pos'] as const) } } : {}),
            } }
          }
          case 5: {
            const o = openings.length ? r.pick(openings) : undefined
            return o ? { type: 'updateOpening', id: o.id, changes: { start: coord(), width: r.int(30, 500) } } : { type: 'redo' }
          }
          case 6: return { type: 'addFurniture', furniture: { id: id('f'), catalogId: 'lit', label: 'Lit', x: coord(), y: coord(), w: dim(), d: dim(), rotation: r.pick([0, 90, 180, 270] as const) } }
          case 7: {
            const f = furniture.length ? r.pick(furniture) : undefined
            return f ? { type: 'updateFurniture', id: f.id, changes: { x: coord(), y: coord(), w: dim(), d: dim() } } : { type: 'undo' }
          }
          case 8: {
            const f = furniture.length ? r.pick(furniture) : undefined
            return f ? { type: 'rotateFurniture', id: f.id } : { type: 'redo' }
          }
          case 9: return { type: 'setStairs', rect: r.next() < 0.2 ? null : rect() }
          case 10: return { type: 'addUpperLevel' }
          case 11: return { type: 'removeUpperLevel' }
          case 12: {
            const cibles = [
              ...rooms.map((x) => ({ kind: 'room' as const, id: x.id })),
              ...openings.map((x) => ({ kind: 'opening' as const, id: x.id })),
              ...furniture.map((x) => ({ kind: 'furniture' as const, id: x.id })),
            ]
            return { type: 'select', selection: cibles.length ? r.pick(cibles) : null }
          }
          case 13: return { type: 'deleteSelection' }
          case 14: return { type: 'undo' }
          default: return { type: 'redo' }
        }
      }

      for (let i = 0; i < 60; i++) {
        const a = action()
        s = editorReducer(s, a)
        const res: ReturnType<typeof parsePlan> = parsePlan(s.plan as Plan)
        if (!res.ok) throw new Error(`run ${run}, action ${i} ${JSON.stringify(a)} : ${res.issues.join(' ; ')}`)
      }
    }
  })
})
