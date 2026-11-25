import { describe, expect, it } from 'vitest'
import { parsePlan, rectangularSite, type Furniture, type Plan, type Room } from '@digimmo/domain'
import { currentLevel, editorReducer, initEditor, isDirty, type Action } from './reducer'
import type { EditorState } from './types'

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze)
    Object.freeze(o)
  }
  return o
}

const room: Room = { id: 'r1', type: 'sejour', name: 'Salon', rect: { x: 0, y: 0, w: 400, h: 300 } }
const meuble: Furniture = { id: 'f1', catalogId: 'canape', label: 'Canapé', x: 50, y: 50, w: 100, d: 80, rotation: 270 }
const vide = (): Plan => ({ levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }], stairs: null })
const avecPiece = (): Plan => ({
  levels: [{ id: 'rdc', rooms: [room], openings: [], furniture: [meuble] }], stairs: null,
})
const init = (plan: Plan = vide()): EditorState => deepFreeze(initEditor(plan, rectangularSite(2000, 3000, 'south')))
const run = (s: EditorState, ...actions: Action[]) =>
  actions.reduce((acc, a) => deepFreeze(editorReducer(acc, a)), s)

describe('initEditor', () => {
  it('démarre au RDC avec la vue du terrain + 10 %', () => {
    const s = init()
    expect(s.levelId).toBe('rdc')
    expect(s.tool).toBe('select')
    expect(s.selection).toBeNull()
    expect(s.savedPlan).toBe(s.plan)
    expect(s.view.width).toBeCloseTo(2400)
    expect(s.view.height).toBeCloseTo(3600)
  })
})

describe('historique', () => {
  it('addRoom puis undo / redo', () => {
    const s0 = init()
    const s1 = run(s0, { type: 'addRoom', room })
    expect(currentLevel(s1).rooms).toHaveLength(1)
    const s2 = run(s1, { type: 'undo' })
    expect(s2.plan).toEqual(s0.plan)
    const s3 = run(s2, { type: 'redo' })
    expect(currentLevel(s3).rooms).toEqual([room])
  })
  it('limite à 100 entrées', () => {
    let s = init()
    for (let i = 0; i < 101; i++) s = run(s, { type: 'addRoom', room: { ...room, id: `r${i}` } })
    expect(s.past).toHaveLength(100)
  })
  it('select et setView n’empilent rien', () => {
    const s = run(init(avecPiece()), { type: 'select', selection: { kind: 'room', id: 'r1' } },
      { type: 'setView', view: { x: 0, y: 0, width: 1, height: 1 } })
    expect(s.past).toHaveLength(0)
  })
  it('updateRoom identique n’empile rien', () => {
    const s = run(init(avecPiece()), { type: 'updateRoom', id: 'r1', changes: { name: 'Salon' } })
    expect(s.past).toHaveLength(0)
  })
  it('id inconnu : sans effet', () => {
    const s0 = init(avecPiece())
    expect(run(s0, { type: 'updateRoom', id: 'zz', changes: { name: 'x' } })).toBe(s0)
    expect(run(s0, { type: 'rotateFurniture', id: 'zz' })).toBe(s0)
  })
  it('une modification vide le futur ; undo/redo gardent savedPlan et vue', () => {
    const s0 = init()
    const s1 = run(s0, { type: 'addRoom', room }, { type: 'undo' })
    expect(s1.future).toHaveLength(1)
    expect(s1.savedPlan).toBe(s0.savedPlan)
    expect(s1.view).toBe(s0.view)
    expect(run(s1, { type: 'addRoom', room: { ...room, id: 'x' } }).future).toHaveLength(0)
  })
})

describe('pièces et meubles', () => {
  it('déplacer une pièce translate ses meubles', () => {
    const s = run(init(avecPiece()), {
      type: 'updateRoom', id: 'r1', changes: { rect: { x: 100, y: 50, w: 400, h: 300 } },
    })
    expect(currentLevel(s).furniture[0]).toMatchObject({ x: 150, y: 100 })
  })
  it('deleteSelection sur une pièce supprime ses meubles', () => {
    const s = run(init(avecPiece()), { type: 'select', selection: { kind: 'room', id: 'r1' } }, { type: 'deleteSelection' })
    expect(currentLevel(s).rooms).toHaveLength(0)
    expect(currentLevel(s).furniture).toHaveLength(0)
    expect(s.selection).toBeNull()
  })
  it('rotateFurniture 270 → 0', () => {
    const s = run(init(avecPiece()), { type: 'rotateFurniture', id: 'f1' })
    expect(currentLevel(s).furniture[0]!.rotation).toBe(0)
  })
})

describe('niveaux et escalier', () => {
  it('addUpperLevel bascule sur r1, sans effet s’il existe', () => {
    const s = run(init(), { type: 'addUpperLevel' })
    expect(s.levelId).toBe('r1')
    expect(run(s, { type: 'addUpperLevel' })).toBe(s)
  })
  it('removeUpperLevel supprime r1 et l’escalier', () => {
    const s = run(init(), { type: 'addUpperLevel' }, { type: 'setStairs', rect: { x: 0, y: 0, w: 100, h: 200 } },
      { type: 'removeUpperLevel' })
    expect(s.plan.levels).toHaveLength(1)
    expect(s.plan.stairs).toBeNull()
    expect(s.levelId).toBe('rdc')
  })
})

describe('corrections de revue', () => {
  it('addUpperLevel, undo, addRoom : la pièce va sur rdc', () => {
    const s = run(init(), { type: 'addUpperLevel' }, { type: 'undo' }, { type: 'addRoom', room })
    expect(s.levelId).toBe('rdc')
    expect(s.plan.levels[0]!.rooms).toEqual([room])
  })
  it('redo ramène aussi un levelId valide', () => {
    const s = run(init(), { type: 'addUpperLevel' }, { type: 'undo' }, { type: 'redo' })
    expect(s.plan.levels).toHaveLength(2)
  })
  it('setStairs sans r1 est sans effet', () => {
    const s0 = init()
    expect(run(s0, { type: 'setStairs', rect: { x: 0, y: 0, w: 100, h: 200 } })).toBe(s0)
  })
  it('redimensionner par le bord gauche ne déplace pas les meubles', () => {
    const s = run(init(avecPiece()), {
      type: 'updateRoom', id: 'r1', changes: { rect: { x: 100, y: 0, w: 300, h: 300 } },
    })
    expect(currentLevel(s).furniture[0]).toMatchObject({ x: 50, y: 50 })
  })
  it('rotateFurniture tourne autour du centre et reste dans la pièce', () => {
    const lit: Furniture = { id: 'f1', catalogId: 'lit', label: 'Lit', x: 300, y: 50, w: 100, d: 60, rotation: 0 }
    const plan: Plan = { levels: [{ id: 'rdc', rooms: [room], openings: [], furniture: [lit] }], stairs: null }
    const s = run(init(plan), { type: 'rotateFurniture', id: 'f1' })
    expect(currentLevel(s).furniture[0]).toMatchObject({ rotation: 90, x: 320, y: 30 })
  })
})

describe('isDirty', () => {
  it('faux / vrai / faux selon markSaved et undo', () => {
    const s0 = init()
    expect(isDirty(s0)).toBe(false)
    const s1 = run(s0, { type: 'addRoom', room })
    expect(isDirty(s1)).toBe(true)
    expect(isDirty(run(s1, { type: 'markSaved', plan: s1.plan }))).toBe(false)
    expect(isDirty(run(s1, { type: 'undo' }))).toBe(false)
  })

  describe('déplacement et ouvertures', () => {
    const A: Room = { id: 'a', type: 'sejour', name: 'A', rect: { x: 0, y: 0, w: 400, h: 300 } }
    const B: Room = { id: 'b', type: 'chambre', name: 'B', rect: { x: 400, y: 0, w: 300, h: 300 } }
    const ext = { id: 'o1', kind: 'door' as const, orientation: 'h' as const, fixed: 0, start: 100, width: 90 }
    const int = { id: 'o2', kind: 'door' as const, orientation: 'v' as const, fixed: 400, start: 100, width: 90 }
    const extV = { id: 'o3', kind: 'window' as const, orientation: 'v' as const, fixed: 0, start: 50, width: 100 }
    const plan = (): Plan => ({
      levels: [{ id: 'rdc', rooms: [A, B], openings: [ext, int, extV], furniture: [] }], stairs: null,
    })
    it('un déplacement pur translate les ouvertures des murs extérieurs de la pièce seulement', () => {
      const s = run(init(plan()), { type: 'updateRoom', id: 'a', changes: { rect: { x: 20, y: 30, w: 400, h: 300 } } })
      const o = Object.fromEntries(currentLevel(s).openings.map((x) => [x.id, x]))
      expect(o.o1).toMatchObject({ fixed: 30, start: 120 })
      expect(o.o3).toMatchObject({ fixed: 20, start: 80 })
      expect(o.o2).toMatchObject({ fixed: 400, start: 100 })
    })
    it('un redimensionnement ne déplace aucune ouverture', () => {
      const s = run(init(plan()), { type: 'updateRoom', id: 'a', changes: { rect: { x: 0, y: 0, w: 450, h: 300 } } })
      expect(currentLevel(s).openings).toEqual([ext, int, extV])
    })
  })
  it('rotateFurniture : 4 rotations d\'un 75 × 40 ramènent exactement à x/y d\'origine', () => {
    const t: Furniture = { id: 'f1', catalogId: 'tv', label: 'Meuble TV', x: 101, y: 57, w: 75, d: 40, rotation: 0 }
    const plan: Plan = { levels: [{ id: 'rdc', rooms: [room], openings: [], furniture: [t] }], stairs: null }
    let s = init(plan)
    for (let i = 0; i < 4; i++) s = run(s, { type: 'rotateFurniture', id: 'f1' })
    expect(currentLevel(s).furniture[0]).toMatchObject({ x: 101, y: 57, w: 75, d: 40, rotation: 0 })
  })
  it('setTool hors Meuble désarme le meuble', () => {
    const s0 = { ...init(vide()), pendingFurniture: 'lit' }
    expect(run(s0, { type: 'setTool', tool: 'select' }).pendingFurniture).toBeNull()
    expect(run(s0, { type: 'setTool', tool: 'furniture' }).pendingFurniture).toBe('lit')
  })
  it('rotateFurniture : un lit en x = 0 reste dans [0, 100000] et le plan est valide', () => {
    const lit: Furniture = { id: 'f1', catalogId: 'lit', label: 'Lit', x: 0, y: 0, w: 140, d: 190, rotation: 0 }
    const plan: Plan = { levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [lit] }], stairs: null }
    const f = currentLevel(run(init(plan), { type: 'rotateFurniture', id: 'f1' })).furniture[0]!
    expect(f.x).toBeGreaterThanOrEqual(0)
    expect(f.y).toBeGreaterThanOrEqual(0)
    const plan2: Plan = { levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [{ ...lit, w: 160, d: 60 }] }], stairs: null }
    const g = currentLevel(run(init(plan2), { type: 'rotateFurniture', id: 'f1' })).furniture[0]!
    expect(g.y).toBeGreaterThanOrEqual(0)
    expect(() => parsePlan({ levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [f] }], stairs: null })).not.toThrow()
  })
  it('rotateFurniture : près de 100000 l\'empreinte reste dans le repère', () => {
    const lit: Furniture = { id: 'f1', catalogId: 'lit', label: 'Lit', x: 99_860, y: 99_810, w: 140, d: 190, rotation: 90 }
    const plan: Plan = { levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [lit] }], stairs: null }
    const f = currentLevel(run(init(plan), { type: 'rotateFurniture', id: 'f1' })).furniture[0]!
    expect(f.x + f.w).toBeLessThanOrEqual(100_000)
    expect(f.y + f.d).toBeLessThanOrEqual(100_000)
  })
})
