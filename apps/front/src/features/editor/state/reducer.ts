import type { Furniture, Level, Opening, Plan, Rect, Room, Site } from '@digimmo/domain'
import { computeWallSegments, containsRect, furnitureFootprint } from '@digimmo/domain'
import { bornerValeur, clampRect, clampTranslation, MAX_CM } from '../geometry/bounds'
import type { EditorState, Selection, Tool, View } from './types'

export const HISTORY_MAX = 100

export type Action =
  | { type: 'setTool'; tool: Tool }
  | { type: 'select'; selection: Selection }
  | { type: 'setLevel'; levelId: EditorState['levelId'] }
  | { type: 'setView'; view: View }
  | { type: 'addRoom'; room: Room }
  | { type: 'updateRoom'; id: string; changes: Partial<Omit<Room, 'id'>> }
  | { type: 'addOpening'; opening: Opening }
  | { type: 'updateOpening'; id: string; changes: Partial<Omit<Opening, 'id'>> }
  | { type: 'addFurniture'; furniture: Furniture }
  | { type: 'updateFurniture'; id: string; changes: Partial<Omit<Furniture, 'id'>> }
  | { type: 'rotateFurniture'; id: string }
  | { type: 'setStairs'; rect: Rect | null }
  | { type: 'addUpperLevel' }
  | { type: 'removeUpperLevel' }
  | { type: 'deleteSelection' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'markSaved'; plan: Plan }
  | { type: 'armFurniture'; catalogId: string | null }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Vue initiale : boîte englobante du terrain plus 10 % de marge. */
export function initEditor(plan: Plan, site: Site): EditorState {
  const xs = site.boundary.map((p) => p.x)
  const ys = site.boundary.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const mx = (maxX - minX) * 0.1, my = (maxY - minY) * 0.1
  return {
    plan, levelId: 'rdc', tool: 'select', selection: null,
    view: { x: minX - mx, y: minY - my, width: maxX - minX + 2 * mx, height: maxY - minY + 2 * my },
    past: [], future: [], savedPlan: plan, pendingFurniture: null,
  }
}

export const isDirty = (state: EditorState): boolean => !same(state.plan, state.savedPlan)

export function currentLevel(state: EditorState): Level {
  return state.plan.levels.find((l) => l.id === state.levelId) ?? state.plan.levels[0]!
}

/** Meuble « appartenant » à une pièce : empreinte contenue (règle 11 du domaine). */
const inRoom = (room: Room, f: Furniture) => containsRect(room.rect, furnitureFootprint(f))

const mapLevel = (plan: Plan, levelId: string, fn: (l: Level) => Level): Plan => ({
  ...plan, levels: plan.levels.map((l) => (l.id === levelId ? fn(l) : l)),
})

/** Applique un nouveau plan : empile l'ancien dans l'historique sauf s'il est identique. */
function commit(state: EditorState, plan: Plan, extra: Partial<EditorState> = {}): EditorState {
  if (same(plan, state.plan)) return { ...state, ...extra }
  return {
    ...state, ...extra, plan,
    past: [...state.past, state.plan].slice(-HISTORY_MAX),
    future: [],
  }
}

/**
 * Rotation de 90° autour du centre de l'empreinte (cm entiers). Quand w − d est impair, le centre
 * tombe sur un demi-cm : on arrondit vers le bas à l'aller (rotation 0/180) et on compense au retour
 * (90/270), si bien que quatre rotations ramènent exactement à la position d'origine.
 */
function rotate90(f: Furniture): Furniture {
  const sens = f.rotation === 0 || f.rotation === 180 ? 1 : -1
  const r: Furniture = {
    ...f,
    rotation: ((f.rotation + 90) % 360) as Furniture['rotation'],
    x: f.x + sens * Math.floor((f.w - f.d) / 2),
    y: f.y + sens * Math.floor((f.d - f.w) / 2),
  }
  // Au bord du repère, l'empreinte tournée est ramenée dans [0, 100000] (réversibilité exacte perdue à cet endroit).
  return rangerMeuble(r)
}

/** Position du meuble ramenée pour que son empreinte (et sa taille) tienne dans le repère. */
function rangerMeuble(f: Furniture): Furniture {
  const w = Math.min(Math.max(f.w, 1), MAX_CM), d = Math.min(Math.max(f.d, 1), MAX_CM)
  const g = { ...f, w, d }
  const fp = furnitureFootprint(g)
  return { ...g, x: bornerValeur(g.x, MAX_CM - fp.w), y: bornerValeur(g.y, MAX_CM - fp.h) }
}

/** Ouverture ramenée dans le repère (mur, début et largeur). */
function rangerOuverture(o: Opening): Opening {
  const width = Math.min(Math.max(o.width, 1), MAX_CM)
  return { ...o, width, fixed: bornerValeur(o.fixed), start: bornerValeur(o.start, MAX_CM - width) }
}

/** Rectangle occupé par une ouverture (épaisseur nulle) pour borner une translation. */
const rectOuverture = (o: Opening): Rect =>
  o.orientation === 'h' ? { x: o.start, y: o.fixed, w: o.width, h: 0 } : { x: o.fixed, y: o.start, w: 0, h: o.width }

const levelOf = (plan: Plan, pick: (l: Level) => boolean) => plan.levels.find(pick)

const validLevel = (plan: Plan, state: EditorState): Pick<EditorState, 'levelId'> =>
  ({ levelId: plan.levels.some((l) => l.id === state.levelId) ? state.levelId : 'rdc' })

/** L'outil escalier n'a de sens qu'avec un niveau r1 : sans lui (annulation, suppression), retour à « select ». */
export function editorReducer(state: EditorState, action: Action): EditorState {
  const next = reduire(state, action)
  return next.tool === 'stairs' && !next.plan.levels.some((l) => l.id === 'r1') ? { ...next, tool: 'select' } : next
}

function reduire(state: EditorState, action: Action): EditorState {
  const { plan } = state
  switch (action.type) {
    case 'setTool':
      return { ...state, tool: action.tool, pendingFurniture: action.tool === 'furniture' ? state.pendingFurniture : null }
    case 'select':
      return { ...state, selection: action.selection }
    case 'setLevel':
      return plan.levels.some((l) => l.id === action.levelId)
        ? { ...state, levelId: action.levelId, selection: null }
        : state
    case 'setView':
      return { ...state, view: action.view }
    case 'armFurniture':
      return { ...state, pendingFurniture: action.catalogId }
    case 'markSaved':
      return { ...state, savedPlan: action.plan }

    case 'addRoom':
      return commit(state, mapLevel(plan, currentLevel(state).id, (l) => ({ ...l, rooms: [...l.rooms, { ...action.room, rect: clampRect(action.room.rect) }] })))
    case 'addOpening':
      return commit(state, mapLevel(plan, currentLevel(state).id, (l) => ({ ...l, openings: [...l.openings, rangerOuverture(action.opening)] })))
    case 'addFurniture':
      return commit(state, mapLevel(plan, currentLevel(state).id, (l) => ({ ...l, furniture: [...l.furniture, rangerMeuble(action.furniture)] })))

    case 'updateRoom': {
      const lvl = levelOf(plan, (l) => l.rooms.some((r) => r.id === action.id))
      if (!lvl) return state
      return commit(state, mapLevel(plan, lvl.id, (l) => {
        const old = l.rooms.find((r) => r.id === action.id)!
        const voulu: Room = { ...old, ...action.changes }
        const pureMove = voulu.rect.w === old.rect.w && voulu.rect.h === old.rect.h
        // Déplacement pur : la translation est bornée pour que la pièce, ses meubles et ses ouvertures restent dans le repère.
        let dx = pureMove ? voulu.rect.x - old.rect.x : 0
        let dy = pureMove ? voulu.rect.y - old.rect.y : 0
        const deplace = dx !== 0 || dy !== 0
        // Ouvertures sur les murs extérieurs de la pièce (segments qu'elle seule borde), calculées avant le déplacement.
        const murs = deplace ? computeWallSegments(l.rooms).filter((s) => s.roomIds.length === 1 && s.roomIds[0] === old.id) : []
        const surMur = (o: Opening) => murs.some((s) =>
          s.orientation === o.orientation && s.fixed === o.fixed && o.start >= s.start && o.start + o.width <= s.end)
        const suivis = l.furniture.filter((f) => inRoom(old, f))
        const portees = l.openings.filter(surMur)
        if (deplace) {
          ;({ dx, dy } = clampTranslation(
            [old.rect, ...suivis.map(furnitureFootprint), ...portees.map(rectOuverture)], dx, dy))
        }
        const moved = dx !== 0 || dy !== 0
        const next: Room = pureMove
          ? { ...voulu, rect: { ...old.rect, x: old.rect.x + dx, y: old.rect.y + dy } }
          : { ...voulu, rect: clampRect(voulu.rect) }
        return {
          ...l,
          rooms: l.rooms.map((r) => (r.id === old.id ? next : r)),
          openings: !moved ? l.openings : l.openings.map((o) => !portees.includes(o) ? o
            : o.orientation === 'h' ? { ...o, start: o.start + dx, fixed: o.fixed + dy }
              : { ...o, start: o.start + dy, fixed: o.fixed + dx }),
          furniture: !moved ? l.furniture
            : l.furniture.map((f) => (suivis.includes(f) ? { ...f, x: f.x + dx, y: f.y + dy } : f)),
        }
      }))
    }
    case 'updateOpening': {
      const lvl = levelOf(plan, (l) => l.openings.some((o) => o.id === action.id))
      if (!lvl) return state
      return commit(state, mapLevel(plan, lvl.id, (l) => ({
        ...l, openings: l.openings.map((o) => (o.id === action.id ? rangerOuverture({ ...o, ...action.changes }) : o)),
      })))
    }
    case 'updateFurniture': {
      const lvl = levelOf(plan, (l) => l.furniture.some((f) => f.id === action.id))
      if (!lvl) return state
      return commit(state, mapLevel(plan, lvl.id, (l) => ({
        ...l, furniture: l.furniture.map((f) => (f.id === action.id ? rangerMeuble({ ...f, ...action.changes }) : f)),
      })))
    }
    case 'rotateFurniture': {
      const lvl = levelOf(plan, (l) => l.furniture.some((f) => f.id === action.id))
      if (!lvl) return state
      return commit(state, mapLevel(plan, lvl.id, (l) => ({
        ...l,
        furniture: l.furniture.map((f) =>
          f.id === action.id ? rotate90(f) : f),
      })))
    }
    case 'setStairs':
      if (action.rect && !plan.levels.some((l) => l.id === 'r1')) return state
      return commit(state, { ...plan, stairs: action.rect ? { rect: clampRect(action.rect) } : null })

    case 'addUpperLevel':
      if (plan.levels.some((l) => l.id === 'r1')) return state
      return commit(state, {
        ...plan, levels: [...plan.levels, { id: 'r1', rooms: [], openings: [], furniture: [] }],
      }, { levelId: 'r1' })
    case 'removeUpperLevel':
      if (!plan.levels.some((l) => l.id === 'r1')) return state
      return commit(state, { levels: plan.levels.filter((l) => l.id !== 'r1'), stairs: null }, {
        levelId: 'rdc', selection: null,
      })

    case 'deleteSelection': {
      const sel = state.selection
      if (!sel) return state
      let next: Plan
      if (sel.kind === 'stairs') next = { ...plan, stairs: null }
      else {
        const lvl = levelOf(plan, (l) =>
          sel.kind === 'room' ? l.rooms.some((r) => r.id === sel.id)
            : sel.kind === 'opening' ? l.openings.some((o) => o.id === sel.id)
              : l.furniture.some((f) => f.id === sel.id))
        if (!lvl) return { ...state, selection: null }
        next = mapLevel(plan, lvl.id, (l) => {
          if (sel.kind === 'opening') return { ...l, openings: l.openings.filter((o) => o.id !== sel.id) }
          if (sel.kind === 'furniture') return { ...l, furniture: l.furniture.filter((f) => f.id !== sel.id) }
          const room = l.rooms.find((r) => r.id === sel.id)!
          return {
            ...l,
            rooms: l.rooms.filter((r) => r.id !== sel.id),
            furniture: l.furniture.filter((f) => !inRoom(room, f)),
          }
        })
      }
      return commit(state, next, { selection: null })
    }

    case 'undo': {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      return { ...state, ...validLevel(prev, state), plan: prev, past: state.past.slice(0, -1), future: [plan, ...state.future], selection: null }
    }
    case 'redo': {
      const nxt = state.future[0]
      if (!nxt) return state
      return { ...state, ...validLevel(nxt, state), plan: nxt, past: [...state.past, plan].slice(-HISTORY_MAX), future: state.future.slice(1), selection: null }
    }
  }
}
