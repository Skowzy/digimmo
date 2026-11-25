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
const ESCALIER_CLIC_CM = { w: 100, h: 300 } // largeur × longueur
const MIN_CM = 50
const MAX_CM = 100_000 // borne du schéma du domaine (coordonnées 0..100000)

const borne = (v: number, max = MAX_CM) => Math.min(Math.max(v, 0), max)
/** Garde le rectangle dans [0, MAX] en conservant sa taille. */
const dansRepere = (r: Rect): Rect => ({ ...r, x: borne(r.x, MAX_CM - r.w), y: borne(r.y, MAX_CM - r.h) })

/** Élément déplaçable ou redimensionnable : une pièce ou l'escalier. */
type Cible = { kind: 'room' | 'stairs'; id: string; rect: Rect }
type Geste =
  | { kind: 'draw'; id: number; client: Point; start: Point; pour: 'room' | 'stairs' }
  | { kind: 'move'; id: number; client: Point; start: Point; cible: Cible; moved: boolean }
  | { kind: 'resize'; id: number; client: Point; cible: Cible; edge: ResizeEdge; moved: boolean }

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
  const [actif, setActif] = useState(false)
  const niveau = currentLevel(state)
  const aEtage = state.plan.levels.some((l) => l.id === 'r1')

  // Changer d'outil efface le message (ajustement d'état pendant le rendu).
  const [outilVu, setOutilVu] = useState(state.tool)
  if (outilVu !== state.tool) { setOutilVu(state.tool); setLimite(false) }

  const annuler = useCallback(() => {
    if (!geste.current) return
    geste.current = null
    setApercu(null)
    setActif(false)
  }, [])
  // Écouteurs de fenêtre seulement pendant un geste ; Échap est consommé (pas de raccourci concurrent).
  useEffect(() => {
    if (!actif) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      annuler()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', annuler)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', annuler)
    }
  }, [actif, annuler])

  const seuil = (svg: SVGSVGElement) => screenThreshold(state.view, svg.getBoundingClientRect().width)
  const autres = (exclu?: Cible) => niveau.rooms.filter((r) => exclu?.kind !== 'room' || r.id !== exclu.id).map((r) => r.rect)

  const calculer = (g: Geste, svg: SVGSVGElement, e: { clientX: number; clientY: number }): Rect | null => {
    const t = seuil(svg)
    const p = svgPoint(svg, e.clientX, e.clientY)
    if (g.kind === 'draw') {
      const ancrer = (pt: Point) => {
        const z = { x: pt.x, y: pt.y, w: 0, h: 0 }
        const c = candidats(autres(), z, t)
        return { x: borne(snapRect(z, c.pourX, t).x), y: borne(snapRect(z, c.pourY, t).y) }
      }
      return dansRepere(normaliser(ancrer(g.start), ancrer(p)))
    }
    if (g.kind === 'move') {
      const r0 = g.cible.rect
      const brut = { ...r0, x: r0.x + p.x - g.start.x, y: r0.y + p.y - g.start.y }
      const c = candidats(autres(g.cible), brut, t)
      return dansRepere({ ...brut, x: snapRect(brut, c.pourX, t).x, y: snapRect(brut, c.pourY, t).y })
    }
    const r0 = g.cible.rect
    const c = candidats(autres(g.cible), r0, t)
    const pb = { x: borne(p.x), y: borne(p.y) }
    const rx = snapResize(r0, g.edge, pb, c.pourX, t, MIN_CM)
    const ry = snapResize(r0, g.edge, pb, c.pourY, t, MIN_CM)
    const gauche = g.edge.includes('w') ? rx.x : r0.x
    const droite = g.edge.includes('e') ? rx.x + rx.w : r0.x + r0.w
    const haut = g.edge.includes('n') ? ry.y : r0.y
    const bas = g.edge.includes('s') ? ry.y + ry.h : r0.y + r0.h
    return dansRepere({ x: gauche, y: haut, w: droite - gauche, h: bas - haut })
  }

  const creer = (rect: Rect, pour: 'room' | 'stairs') => {
    if (pour === 'stairs') {
      dispatch({ type: 'setStairs', rect })
      dispatch({ type: 'select', selection: { kind: 'stairs', id: 'stairs' } })
      dispatch({ type: 'setTool', tool: 'select' })
      return
    }
    if (niveau.rooms.length >= MAX_ROOMS) { setLimite(true); return }
    const ids = new Set(state.plan.levels.flatMap((l) => l.rooms.map((r) => r.id)))
    const room: Room = { id: newId('r', ids), type: 'autre', name: nextRoomName(niveau.rooms), rect }
    setLimite(false)
    dispatch({ type: 'addRoom', room })
    dispatch({ type: 'select', selection: { kind: 'room', id: room.id } })
    dispatch({ type: 'setTool', tool: 'select' })
  }

  const demarrer = (g: Geste) => { geste.current = g; setActif(true) }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    if (geste.current) {
      if (geste.current.id !== e.pointerId) return // second doigt : on ne touche pas au premier
      annuler() // geste périmé (pointerup perdu) : le nouveau remplace
    }
    const svg = e.currentTarget
    const cible = e.target instanceof Element ? e.target : null
    const p = svgPoint(svg, e.clientX, e.clientY)
    const client = { x: e.clientX, y: e.clientY }
    const capturer = () => svg.setPointerCapture?.(e.pointerId)
    if (state.tool === 'room' || (state.tool === 'stairs' && aEtage)) {
      capturer()
      demarrer({ kind: 'draw', id: e.pointerId, client, start: p, pour: state.tool })
      return
    }
    if (state.tool !== 'select') return
    const poignee = cible?.closest('[data-handle]')?.getAttribute('data-handle')
    const sel = state.selection
    const escalier = state.plan.stairs
    const selRoom = sel?.kind === 'room' ? niveau.rooms.find((r) => r.id === sel.id) : undefined
    const selCible: Cible | undefined = selRoom ? { kind: 'room', id: selRoom.id, rect: selRoom.rect }
      : sel?.kind === 'stairs' && escalier ? { kind: 'stairs', id: 'stairs', rect: escalier.rect } : undefined
    if (poignee && selCible) {
      capturer()
      demarrer({ kind: 'resize', id: e.pointerId, client, cible: selCible, edge: poignee as ResizeEdge, moved: false })
      return
    }
    setLimite(false)
    let touchee: Cible | undefined
    if (escalier && cible?.closest('[data-stairs]')) touchee = { kind: 'stairs', id: 'stairs', rect: escalier.rect }
    else {
      const id = cible?.closest('[data-room]')?.getAttribute('data-room')
      const room = id ? niveau.rooms.find((r) => r.id === id) : undefined
      if (room) touchee = { kind: 'room', id: room.id, rect: room.rect }
    }
    if (!touchee) { dispatch({ type: 'select', selection: null }); return }
    dispatch({ type: 'select', selection: { kind: touchee.kind, id: touchee.id } })
    capturer()
    demarrer({ kind: 'move', id: e.pointerId, client, start: p, cible: touchee, moved: false })
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = geste.current
    if (!g || g.id !== e.pointerId) return
    if ((e.buttons & 1) === 0) { annuler(); return } // bouton relâché hors du plan : geste périmé
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
    setActif(false)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const svg = e.currentTarget
    if (g.kind === 'draw') {
      const dist = Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y)
      if (dist >= SEUIL_CLIC_PX) { creer(calculer(g, svg, e)!, g.pour); return }
      const t = seuil(svg)
      const { w, h } = g.pour === 'stairs' ? ESCALIER_CLIC_CM : { w: TAILLE_CLIC_CM, h: TAILLE_CLIC_CM }
      const centre = { x: g.start.x - w / 2, y: g.start.y - h / 2, w, h }
      const c = candidats(autres(), centre, t)
      creer(dansRepere({ ...centre, x: snapRect(centre, c.pourX, t).x, y: snapRect(centre, c.pourY, t).y }), g.pour)
      return
    }
    if (!g.moved) return
    const rect = calculer(g, svg, e)!
    const r0 = g.cible.rect
    if (rect.x === r0.x && rect.y === r0.y && rect.w === r0.w && rect.h === r0.h) return
    setLimite(false)
    if (g.cible.kind === 'stairs') dispatch({ type: 'setStairs', rect })
    else dispatch({ type: 'updateRoom', id: g.cible.id, changes: { rect } })
  }

  return {
    apercu,
    limite,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => {
        if (geste.current?.id === e.pointerId) annuler()
      },
      // lostpointercapture remonte des enfants (capture implicite) : seul celui du SVG compte.
      onLostPointerCapture: (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.target === e.currentTarget && geste.current?.id === e.pointerId) annuler()
      },
    },
  }
}
