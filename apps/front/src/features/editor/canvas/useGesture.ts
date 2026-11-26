import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { computeWallSegments, findSegmentFor, furnitureFootprint, type Furniture, type Opening, type Point, type Rect, type Room, type WallSegment } from '@digimmo/domain'
import type { FurnitureItem } from '../../../lib/queries'
import { newId, nextRoomName } from '../geometry/ids'
import { bornerValeur, clampRect } from '../geometry/bounds'
import { along, bornesStart, MAX_OUVERTURES, ouvertureCliquee, segmentProche } from '../geometry/openings'
import { screenThreshold, snapRect, snapResize, snapValue, type ResizeEdge } from '../geometry/snap'
import { svgPoint } from '../geometry/svgPoint'
import { currentLevel } from '../state/reducer'
import { useEditor } from '../state/useEditor'

export const MAX_ROOMS = 100
export const LIMITE_PIECES = 'Limite de 100 pièces par niveau atteinte.'
export const MAX_MEUBLES = 500
export const LIMITE_MEUBLES = `Limite de ${MAX_MEUBLES} meubles par niveau atteinte.`
export const LIMITE_OUVERTURES = `Limite de ${MAX_OUVERTURES} ouvertures par niveau atteinte.`
const SEUIL_CLIC_PX = 4
const TAILLE_CLIC_CM = 300
const ESCALIER_CLIC_CM = { w: 100, h: 300 } // largeur × longueur
const MIN_CM = 50
const borne = bornerValeur
const dansRepere = clampRect

/** Élément déplaçable ou redimensionnable : une pièce, l'escalier ou un meuble (déplacement seul). */
type Cible = { kind: 'room' | 'stairs' | 'furniture'; id: string; rect: Rect }
type Geste =
  | { kind: 'draw'; id: number; client: Point; start: Point; pour: 'room' | 'stairs' }
  | { kind: 'move'; id: number; client: Point; start: Point; cible: Cible; moved: boolean }
  | { kind: 'slide'; id: number; client: Point; start: Point; ouv: Opening; seg: WallSegment | null; moved: boolean }
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
export function useGesture(catalogue: FurnitureItem[] = []) {
  const { state, dispatch } = useEditor()
  const geste = useRef<Geste | null>(null)
  const [apercu, setApercu] = useState<Rect | null>(null)
  const [limite, setLimite] = useState<string | null>(null)
  const [survol, setSurvol] = useState<WallSegment | null>(null)
  const [glisse, setGlisse] = useState<{ id: string; start: number } | null>(null)
  const [actif, setActif] = useState(false)
  const niveau = currentLevel(state)
  const aEtage = state.plan.levels.some((l) => l.id === 'r1')

  // Changer d'outil efface le message (ajustement d'état pendant le rendu).
  const [outilVu, setOutilVu] = useState(state.tool)
  if (outilVu !== state.tool) { setOutilVu(state.tool); setLimite(null); setSurvol(null) }

  const annuler = useCallback(() => {
    if (!geste.current) return
    geste.current = null
    setApercu(null)
    setGlisse(null)
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

  const segments = useMemo(() => computeWallSegments(niveau.rooms), [niveau.rooms])
  const outilOuverture = state.tool === 'door' || state.tool === 'window'
  const seuil = (svg: SVGSVGElement) => screenThreshold(state.view, svg.getBoundingClientRect().width)
  const autres = (exclu?: Cible) => [
    ...niveau.rooms.filter((r) => exclu?.kind !== 'room' || r.id !== exclu.id).map((r) => r.rect),
    ...(exclu?.kind === 'furniture' ? niveau.furniture.filter((f) => f.id !== exclu.id).map(furnitureFootprint) : []),
  ]

  const calculer = (g: Exclude<Geste, { kind: 'slide' }>, svg: SVGSVGElement, e: { clientX: number; clientY: number }): Rect | null => {
    const t = seuil(svg)
    const p = svgPoint(svg, e.clientX, e.clientY)
    if (g.kind === 'draw') {
      const ancrer = (pt: Point) => {
        const z = { x: pt.x, y: pt.y, w: 0, h: 0 }
        const c = candidats(autres(), z, t)
        return { x: borne(snapRect(z, c.pourX, t).x), y: borne(snapRect(z, c.pourY, t).y) }
      }
      const a = ancrer(g.start)
      const b = ancrer(p)
      // Côté trop fin : on étend depuis le coin ancré, dans le sens du glisser.
      if (Math.abs(b.x - a.x) < MIN_CM) b.x = a.x + (b.x < a.x ? -MIN_CM : MIN_CM)
      if (Math.abs(b.y - a.y) < MIN_CM) b.y = a.y + (b.y < a.y ? -MIN_CM : MIN_CM)
      return dansRepere(normaliser(a, b))
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

  /** Nouvelle position d'une ouverture glissée : le long du mur seulement, aimantée, bornée au segment. */
  const calculerStart = (g: Extract<Geste, { kind: 'slide' }>, svg: SVGSVGElement, e: { clientX: number; clientY: number }): number => {
    const p = svgPoint(svg, e.clientX, e.clientY)
    const [min, max] = bornesStart(g.ouv.width, g.seg)
    return Math.min(Math.max(snapValue(g.ouv.start + along(g.ouv, p) - along(g.ouv, g.start)), min), max)
  }

  const poser = (p: Point, svg: SVGSVGElement) => {
    const kind = state.tool === 'door' ? 'door' : 'window'
    const seg = segmentProche(segments, p, seuil(svg))
    if (!seg) return
    if (niveau.openings.length >= MAX_OUVERTURES) { setLimite(LIMITE_OUVERTURES); return }
    const ids = new Set(state.plan.levels.flatMap((l) => l.openings.map((o) => o.id)))
    const ouv = ouvertureCliquee(kind, seg, p, niveau.rooms, newId('o', ids))
    if (!ouv) return
    setLimite(null)
    setSurvol(null)
    dispatch({ type: 'addOpening', opening: ouv })
    dispatch({ type: 'select', selection: { kind: 'opening', id: ouv.id } })
    dispatch({ type: 'setTool', tool: 'select' })
  }

  /** Pose le meuble armé, centré sur le point, aimanté aux autres meubles et aux bords de la pièce cliquée. */
  const placer = (p: Point, svg: SVGSVGElement) => {
    const item = catalogue.find((i) => i.id === state.pendingFurniture)
    if (!item) return
    if (niveau.furniture.length >= MAX_MEUBLES) { setLimite(LIMITE_MEUBLES); return }
    const t = seuil(svg)
    const centre = { x: p.x - item.widthCm / 2, y: p.y - item.depthCm / 2, w: item.widthCm, h: item.depthCm }
    const sousClic = niveau.rooms.filter((r) => p.x >= r.rect.x && p.x <= r.rect.x + r.rect.w && p.y >= r.rect.y && p.y <= r.rect.y + r.rect.h)
    const c = candidats([...niveau.furniture.map(furnitureFootprint), ...sousClic.map((r) => r.rect)], centre, t)
    const r = dansRepere({ ...centre, x: snapRect(centre, c.pourX, t).x, y: snapRect(centre, c.pourY, t).y })
    const ids = new Set(state.plan.levels.flatMap((l) => l.furniture.map((f) => f.id)))
    const meuble: Furniture = { id: newId('f', ids), catalogId: item.id, label: item.name, x: r.x, y: r.y, w: item.widthCm, d: item.depthCm, rotation: 0 }
    setLimite(null)
    dispatch({ type: 'addFurniture', furniture: meuble })
    dispatch({ type: 'select', selection: { kind: 'furniture', id: meuble.id } })
  }

  const creer = (rect: Rect, pour: 'room' | 'stairs') => {
    if (pour === 'stairs') {
      dispatch({ type: 'setStairs', rect })
      dispatch({ type: 'select', selection: { kind: 'stairs', id: 'stairs' } })
      dispatch({ type: 'setTool', tool: 'select' })
      return
    }
    if (niveau.rooms.length >= MAX_ROOMS) { setLimite(LIMITE_PIECES); return }
    const ids = new Set(state.plan.levels.flatMap((l) => l.rooms.map((r) => r.id)))
    const room: Room = { id: newId('r', ids), type: 'autre', name: nextRoomName(niveau.rooms), rect }
    setLimite(null)
    dispatch({ type: 'addRoom', room })
    dispatch({ type: 'select', selection: { kind: 'room', id: room.id } })
    dispatch({ type: 'setTool', tool: 'select' })
  }

  const demarrer = (g: Geste) => { geste.current = g; setActif(true) }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    // Valide la saisie en cours dans le panneau avant que la sélection ne le démonte (le blur arriverait trop tard).
    const actif = document.activeElement
    if (actif instanceof HTMLElement && actif.closest('[aria-labelledby="ed-proprietes"]') && /^(INPUT|SELECT|TEXTAREA)$/.test(actif.tagName)) {
      flushSync(() => actif.blur())
    }
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
    if (outilOuverture) { poser(p, svg); return }
    if (state.tool === 'furniture') { placer(p, svg); return }
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
    setLimite(null)
    const idOuv = cible?.closest('[data-opening]')?.getAttribute('data-opening')
    const ouv = idOuv ? niveau.openings.find((o) => o.id === idOuv) : undefined
    if (ouv) {
      dispatch({ type: 'select', selection: { kind: 'opening', id: ouv.id } })
      capturer()
      demarrer({ kind: 'slide', id: e.pointerId, client, start: p, ouv, seg: findSegmentFor(ouv, segments), moved: false })
      return
    }
    let touchee: Cible | undefined
    const idMeuble = cible?.closest('[data-furniture]')?.getAttribute('data-furniture')
    const meuble = idMeuble ? niveau.furniture.find((f) => f.id === idMeuble) : undefined
    if (meuble) touchee = { kind: 'furniture', id: meuble.id, rect: furnitureFootprint(meuble) }
    else if (escalier && cible?.closest('[data-stairs]')) touchee = { kind: 'stairs', id: 'stairs', rect: escalier.rect }
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
    if (!g && outilOuverture) {
      const svg = e.currentTarget
      setSurvol(segmentProche(segments, svgPoint(svg, e.clientX, e.clientY), seuil(svg)))
      return
    }
    if (!g || g.id !== e.pointerId) return
    if ((e.buttons & 1) === 0) { annuler(); return } // bouton relâché hors du plan : geste périmé
    const dist = Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y)
    if (g.kind !== 'draw' && !g.moved) {
      if (dist < SEUIL_CLIC_PX) return
      g.moved = true
    }
    if (g.kind === 'draw' && dist < SEUIL_CLIC_PX) return
    if (g.kind === 'slide') { setGlisse({ id: g.ouv.id, start: calculerStart(g, e.currentTarget, e) }); return }
    setApercu(calculer(g, e.currentTarget, e))
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = geste.current
    if (!g || g.id !== e.pointerId) return
    geste.current = null
    setApercu(null)
    setGlisse(null)
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
    if (g.kind === 'slide') {
      const start = calculerStart(g, svg, e)
      if (start !== g.ouv.start) dispatch({ type: 'updateOpening', id: g.ouv.id, changes: { start } })
      return
    }
    const rect = calculer(g, svg, e)!
    const r0 = g.cible.rect
    if (rect.x === r0.x && rect.y === r0.y && rect.w === r0.w && rect.h === r0.h) return
    setLimite(null)
    if (g.cible.kind === 'furniture') dispatch({ type: 'updateFurniture', id: g.cible.id, changes: { x: rect.x, y: rect.y } })
    else if (g.cible.kind === 'stairs') dispatch({ type: 'setStairs', rect })
    else dispatch({ type: 'updateRoom', id: g.cible.id, changes: { rect } })
  }

  return {
    apercu,
    limite,
    survol,
    glisse,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave: () => setSurvol(null),
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
