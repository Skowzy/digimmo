import { useEffect, useRef, type Dispatch } from 'react'
import { flushSync } from 'react-dom'
import type { Rect } from '@digimmo/domain'
import { currentLevel, type Action } from './state/reducer'
import type { EditorState, Tool } from './state/types'

const MAX = 100_000
const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(max, 0))
const OUTILS: Record<string, Tool> = { v: 'select', p: 'room', d: 'door', f: 'window', m: 'furniture', e: 'stairs' }
const FLECHES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
}

const dansSaisie = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
const dansDialogue = (t: EventTarget | null) =>
  t instanceof Element && (t.closest('[role="dialog"], dialog[open]') !== null)

interface Options { saveNow(): Promise<boolean>; openHelp(): void }

/** Raccourcis clavier de l'éditeur : un seul écouteur `keydown` sur la fenêtre. */
export function useShortcuts(dispatch: Dispatch<Action>, state: EditorState, options: Options) {
  const ref = useRef({ dispatch, state, options })
  useEffect(() => { ref.current = { dispatch, state, options } })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { dispatch, state, options } = ref.current
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()

      if (mod && !e.altKey && k === 's') {
        e.preventDefault()
        const actif = document.activeElement
        // Valide d'abord le champ en cours (commit au blur), puis enregistre le plan à jour.
        if (actif instanceof HTMLElement && actif !== document.body && dansSaisie(actif)) flushSync(() => actif.blur())
        void options.saveNow()
        return
      }
      if (dansSaisie(e.target) || dansDialogue(e.target) || e.defaultPrevented) return

      if (mod && !e.altKey) {
        if (k === 'z') { e.preventDefault(); dispatch({ type: e.shiftKey ? 'redo' : 'undo' }) }
        else if (k === 'y') { e.preventDefault(); dispatch({ type: 'redo' }) }
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const sel = state.selection
      const fleche = FLECHES[e.key]
      if (fleche) {
        if (!sel) return
        const pas = e.shiftKey ? 1 : 10
        const [dx, dy] = [fleche[0] * pas, fleche[1] * pas]
        const level = currentLevel(state)
        const deplacer = (r: Rect): Rect => ({ ...r, x: clamp(r.x + dx, MAX - r.w), y: clamp(r.y + dy, MAX - r.h) })
        if (sel.kind === 'room') {
          const r = level.rooms.find((x) => x.id === sel.id)
          if (r) dispatch({ type: 'updateRoom', id: sel.id, changes: { rect: deplacer(r.rect) } })
        } else if (sel.kind === 'furniture') {
          const f = level.furniture.find((x) => x.id === sel.id)
          if (f) {
            const quarts = f.rotation === 90 || f.rotation === 270
            const n = deplacer({ x: f.x, y: f.y, w: quarts ? f.d : f.w, h: quarts ? f.w : f.d })
            dispatch({ type: 'updateFurniture', id: sel.id, changes: { x: n.x, y: n.y } })
          }
        } else if (sel.kind === 'stairs') {
          if (state.plan.stairs) dispatch({ type: 'setStairs', rect: deplacer(state.plan.stairs.rect) })
        } else {
          const o = level.openings.find((x) => x.id === sel.id)
          const d = o?.orientation === 'h' ? dx : dy
          if (o && d !== 0) dispatch({ type: 'updateOpening', id: sel.id, changes: { start: clamp(o.start + d, MAX - o.width) } })
        }
        e.preventDefault()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!sel) return
        e.preventDefault()
        dispatch({ type: 'deleteSelection' })
        document.querySelector<SVGSVGElement>('svg[aria-label="Plan du projet"]')?.focus()
      } else if (e.key === 'Escape') {
        if (state.pendingFurniture) dispatch({ type: 'armFurniture', catalogId: null })
        else if (sel) dispatch({ type: 'select', selection: null })
      } else if (e.key === '?') {
        e.preventDefault()
        options.openHelp()
      } else if (k === 'r') {
        if (sel?.kind === 'furniture') { e.preventDefault(); dispatch({ type: 'rotateFurniture', id: sel.id }) }
      } else if (k in OUTILS && k.length === 1) {
        const tool = OUTILS[k]!
        if (tool === 'stairs' && !state.plan.levels.some((l) => l.id === 'r1')) return
        dispatch({ type: 'setTool', tool })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
