import { useCallback, useEffect, useRef, useState } from 'react'
import type { Point, Rect, Room } from '@digimmo/domain'
import { newId, nextRoomName } from '../geometry/ids'
import { screenThreshold, snapRect, snapResize, type ResizeEdge } from '../geometry/snap'
import { svgPoint } from '../geometry/svgPoint'
import { currentLevel } from '../state/reducer'
import { useEditor } from '../state/useEditor'

export const MAX_ROOMS = 100
export const LIMITE_PIECES = 'Limite de 100 pièces par niveau atteinte.'
const SEUIL_CLIC_PX = 4
const TAILLE_CLIC_CM = 300
const MIN_CM = 50

type Geste =
  | { kind: 'draw'; id: number; client: Point; start: Point }
  | { kind: 'move'; id: number; client: Point; start: Point; room: Room; moved: boolean }
  | { kind: 'resize'; id: number; client: Point; room: Room; edge: ResizeEdge; moved: boolean }

const chevauche = (a0: number, a1: number, b0: number, b1: number, t: number) => a0 <= b1 + t && b0 <= a1 + t

/** Pièces pouvant attirer le rectangle : celles qui le chevauchent (seuil inclus) sur l'AUTRE axe. */
function candidats(autres: Rect[], r: Rect, t: number): { pourX: Rect[]; pourY: Rect[] } {
  return {
    pourX: autres.filter((o) => chevauche(r.y, r.y + r.h, o.y, o.y + o.h, t)),
    pourY: autres.filter((o) => chevauche(r.x, r.x + r.w, o.x, o.x + o.w, t)),
  }
}

const normaliser = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
  w: Math.max(Math.abs(a.x - b.x), MIN_CM), h: Math.max(Math.abs(a.y - b.y), MIN_CM),
})

/**
 * Gestes du plan (dessin, déplacement, redimensionnement). L'aperçu est un état local :
 * le réducteur n'est sollicité qu'à la fin du geste (une action = une entrée d'historique).
 */
export function useGesture() {
  const { state, dispatch } = useEditor()
  const geste = useRef<Geste | null>(null)
  const [apercu, setApercu] = useState<Rect | null>(null)
  const [limite, setLimite] = useState(false)
  const niveau = currentLevel(state)

  // Changer d'outil efface le message (ajustement d'état pendant le rendu).
  const [outilVu, setOutilVu] = useState(state.tool)
  if (outilVu !== state.tool) { setOutilVu(state.tool); setLimite(false) }

  const annuler = useCallback(() => {
    if (!geste.current) return
    geste.current = null
    setApercu(null)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') annuler() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [annuler])

  const seuil = (svg: SVGSVGElement) => screenThreshold(state.view, svg.getBoundingClientRect().width)
  const autres = (exclu?: string) => niveau.rooms.filter((r) => r.id !== exclu).map((r) => r.rect)

  const calculer = (g: Geste, svg: SVGSVGElement, e: { clientX: number; clientY: number }): Rect | null => {
    const t = seuil(svg)
    const p = svgPoint(svg, e.clientX, e.clientY)
    if (g.kind === 'draw') {
      const ancrer = (pt: Point) => {
        const z = { x: pt.x, y: pt.y, w: 0, h: 0 }
        const c = candidats(autres(), z, t)
        return { x: snapRect(z, c.pourX, t).x, y: snapRect(z, c.pourY, t).y }
      }
      return normaliser(ancrer(g.start), ancrer(p))
    }
    if (g.kind === 'move') {
      const r0 = g.room.rect
      const brut = { ...r0, x: r0.x + p.x - g.start.x, y: r0.y + p.y - g.start.y }
      const c = candidats(autres(g.room.id), brut, t)
      return { ...brut, x: snapRect(brut, c.pourX, t).x, y: snapRect(brut, c.pourY, t).y }
    }
    const r0 = g.room.rect
    const c = candidats(autres(g.room.id), r0, t)
    const rx = snapResize(r0, g.edge, p, c.pourX, t, MIN_CM)
    const ry = snapResize(r0, g.edge, p, c.pourY, t, MIN_CM)
    const gauche = g.edge.includes('w') ? rx.x : r0.x
    const droite = g.edge.includes('e') ? rx.x + rx.w : r0.x + r0.w
    const haut = g.edge.includes('n') ? ry.y : r0.y
    const bas = g.edge.includes('s') ? ry.y + ry.h : r0.y + r0.h
    return { x: gauche, y: haut, w: droite - gauche, h: bas - haut }
  }

  const creer = (rect: Rect) => {
    if (niveau.rooms.length >= MAX_ROOMS) { setLimite(true); return }
    const ids = new Set(state.plan.levels.flatMap((l) => l.rooms.map((r) => r.id)))
    const room: Room = { id: newId('r', ids), type: 'autre', name: nextRoomName(niveau.rooms), rect }
    setLimite(false)
    dispatch({ type: 'addRoom', room })
    dispatch({ type: 'select', selection: { kind: 'room', id: room.id } })
    dispatch({ type: 'setTool', tool: 'select' })
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || geste.current) return
    const svg = e.currentTarget
    const cible = e.target instanceof Element ? e.target : null
    const p = svgPoint(svg, e.clientX, e.clientY)
    const client = { x: e.clientX, y: e.clientY }
    const capturer = () => svg.setPointerCapture?.(e.pointerId)
    if (state.tool === 'room') {
      capturer()
      geste.current = { kind: 'draw', id: e.pointerId, client, start: p }
      return
    }
    if (state.tool !== 'select') return
    const poignee = cible?.closest('[data-handle]')?.getAttribute('data-handle')
    const sel = state.selection
    const selRoom = sel?.kind === 'room' ? niveau.rooms.find((r) => r.id === sel.id) : undefined
    if (poignee && selRoom) {
      capturer()
      geste.current = { kind: 'resize', id: e.pointerId, client, room: selRoom, edge: poignee as ResizeEdge, moved: false }
      return
    }
    const id = cible?.closest('[data-room]')?.getAttribute('data-room')
    const room = id ? niveau.rooms.find((r) => r.id === id) : undefined
    setLimite(false)
    if (!room) { dispatch({ type: 'select', selection: null }); return }
    dispatch({ type: 'select', selection: { kind: 'room', id: room.id } })
    capturer()
    geste.current = { kind: 'move', id: e.pointerId, client, start: p, room, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = geste.current
    if (!g || g.id !== e.pointerId) return
    const dist = Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y)
    if (g.kind !== 'draw' && !g.moved) {
      if (dist < SEUIL_CLIC_PX) return
      g.moved = true
    }
    if (g.kind === 'draw' && dist < SEUIL_CLIC_PX) return
    setApercu(calculer(g, e.currentTarget, e))
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = geste.current
    if (!g || g.id !== e.pointerId) return
    geste.current = null
    setApercu(null)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const svg = e.currentTarget
    if (g.kind === 'draw') {
      const dist = Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y)
      if (dist >= SEUIL_CLIC_PX) { creer(calculer(g, svg, e)!); return }
      const t = seuil(svg)
      const centre = { x: g.start.x - TAILLE_CLIC_CM / 2, y: g.start.y - TAILLE_CLIC_CM / 2, w: TAILLE_CLIC_CM, h: TAILLE_CLIC_CM }
      const c = candidats(autres(), centre, t)
      creer({ ...centre, x: snapRect(centre, c.pourX, t).x, y: snapRect(centre, c.pourY, t).y })
      return
    }
    if (!g.moved) return
    const rect = calculer(g, svg, e)!
    const r0 = g.room.rect
    if (rect.x === r0.x && rect.y === r0.y && rect.w === r0.w && rect.h === r0.h) return
    setLimite(false)
    dispatch({ type: 'updateRoom', id: g.room.id, changes: { rect } })
  }

  return {
    apercu,
    limite,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: annuler,
      onLostPointerCapture: annuler,
    },
  }
}
