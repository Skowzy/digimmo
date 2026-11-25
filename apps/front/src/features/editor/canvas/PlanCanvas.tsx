import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatMeters, type RuleParams, type Site, type Violation } from '@digimmo/domain'
import { Button } from '../../../ui'
import { svgPoint } from '../geometry/svgPoint'
import { currentLevel, initEditor } from '../state/reducer'
import type { View } from '../state/types'
import { useEditor } from '../state/useEditor'
import styles from './PlanCanvas.module.css'
import { RoomShape } from './RoomShape'

const FACTEUR = 1.2
const MIN = 1 / 8 // 800 %
const MAX = 4 // 25 %

type Props = { site: Site; rules: RuleParams; violations: Violation[] }

/** Étend la vue ajustée pour épouser le ratio de l'écran (centrée). */
function ajuster(fit: View, ratio: number | null): View {
  if (!ratio) return fit
  const cx = fit.x + fit.width / 2
  const cy = fit.y + fit.height / 2
  let { width, height } = fit
  if (width / height < ratio) width = height * ratio
  else height = width / ratio
  return { x: cx - width / 2, y: cy - height / 2, width, height }
}

/** Lignes de recul d'un terrain rectangulaire (axes alignés) ; vide sinon. */
function reculs(site: Site, rules: RuleParams) {
  const b = site.boundary
  if (b.length !== 4) return []
  const axes = b.every((p, i) => { const q = b[(i + 1) % 4]!; return p.x === q.x || p.y === q.y })
  if (!axes) return []
  const xs = b.map((p) => p.x), ys = b.map((p) => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const lignes = b.map((p, i) => {
    const q = b[(i + 1) % 4]!
    const voie = i === site.streetEdge
    const d = voie ? rules.setbackStreetCm : rules.setbackSidesCm
    const texte = `${voie ? 'Recul voie' : 'Recul limite'} ${formatMeters(d)}`
    if (p.y === q.y) {
      const haut = p.y < cy
      const y = haut ? y0 + d : y1 - d
      return { key: i, x1: x0, y1: y, x2: x1, y2: y, tx: cx, ty: haut ? y + 18 : y - 6, texte, i }
    }
    const gauche = p.x < cx
    const x = gauche ? x0 + d : x1 - d
    return { key: i, x1: x, y1: y0, x2: x, y2: y1, tx: gauche ? x + 6 : x - 6, ty: cy, texte, i, vertical: true, gauche }
  })
  return lignes
}

export function PlanCanvas({ site, rules, violations }: Props) {
  const { state, dispatch } = useEditor()
  const svgRef = useRef<SVGSVGElement>(null)
  const viewRef = useRef(state.view)
  useEffect(() => { viewRef.current = state.view }, [state.view])
  const fit = useMemo(() => initEditor({ levels: [], stairs: null }, site).view, [site])
  const [ratio, setRatio] = useState<number | null>(null)
  const [espace, setEspace] = useState(false)
  const [panne, setPanne] = useState(false)
  const pan = useRef<{ id: number; cx: number; cy: number; view: View; pxW: number } | null>(null)

  const setView = useCallback((view: View) => dispatch({ type: 'setView', view }), [dispatch])

  // Ratio de l'écran (ResizeObserver absent en jsdom : on garde le ratio courant).
  useEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setRatio(r.width / r.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const premier = useRef(true)
  useEffect(() => {
    if (!ratio) return
    if (premier.current) { // première mesure : cadrer tout le terrain
      premier.current = false
      setView(ajuster(fit, ratio))
      return
    }
    const v = viewRef.current
    const height = v.width / ratio
    if (Math.abs(height - v.height) > 0.5) setView({ x: v.x, y: v.y + (v.height - height) / 2, width: v.width, height })
  }, [ratio, fit, setView])

  const zoomer = useCallback((facteur: number, ancre?: { x: number; y: number }) => {
    const v = viewRef.current
    const largeur = Math.min(fit.width * MAX, Math.max(fit.width * MIN, v.width / facteur))
    const k = largeur / v.width
    if (k === 1) return
    const p = ancre ?? { x: v.x + v.width / 2, y: v.y + v.height / 2 }
    setView({ x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, width: largeur, height: v.height * k })
  }, [fit, setView])

  // Molette : écouteur natif non passif pour pouvoir empêcher le défilement de la page.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomer(e.deltaY < 0 ? FACTEUR : 1 / FACTEUR, svgPoint(el, e.clientX, e.clientY))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomer])

  // Barre d'espace : mode déplacement.
  useEffect(() => {
    const estSaisie = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))
    const bas = (e: KeyboardEvent) => { if (e.code === 'Space' && !estSaisie(e.target)) { setEspace(true); e.preventDefault() } }
    const haut = (e: KeyboardEvent) => { if (e.code === 'Space') setEspace(false) }
    window.addEventListener('keydown', bas)
    window.addEventListener('keyup', haut)
    return () => { window.removeEventListener('keydown', bas); window.removeEventListener('keyup', haut) }
  }, [])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!(e.button === 1 || (espace && e.button === 0))) return
    const pxW = e.currentTarget.getBoundingClientRect().width
    if (!pxW) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pan.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, view: viewRef.current, pxW }
    setPanne(true)
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = pan.current
    if (!p || p.id !== e.pointerId) return
    const cmParPx = p.view.width / p.pxW
    setView({ ...p.view, x: p.view.x - (e.clientX - p.cx) * cmParPx, y: p.view.y - (e.clientY - p.cy) * cmParPx })
  }
  const finPan = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pan.current || pan.current.id !== e.pointerId) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    pan.current = null
    setPanne(false)
  }

  const level = currentLevel(state)
  const autre = state.plan.levels.find((l) => l.id !== level.id)
  const enErreur = useMemo(() => {
    const ids = new Set<string>()
    for (const v of violations) {
      if (v.severity !== 'error' || (v.level && v.level !== level.id)) continue
      v.refs.forEach((r) => ids.add(r))
    }
    return ids
  }, [violations, level.id])

  const b = site.boundary
  const { view } = state
  const sel = state.selection
  const selRect = sel?.kind === 'room' ? level.rooms.find((r) => r.id === sel.id)?.rect
    : sel?.kind === 'stairs' ? state.plan.stairs?.rect : undefined
  const classeSvg = [styles.svg, espace && styles.pan, panne && styles.panActif].filter(Boolean).join(' ')

  return (
    <div className={styles.zone}>
      <svg
        ref={svgRef}
        role="img"
        aria-label="Plan du projet"
        className={classeSvg}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finPan}
        onPointerCancel={finPan}
      >
        <defs>
          <pattern id="grille-10" width={10} height={10} patternUnits="userSpaceOnUse">
            <path className={styles.grille10} d="M10 0H0V10" fill="none" />
          </pattern>
          <pattern id="grille-100" width={100} height={100} patternUnits="userSpaceOnUse">
            <path className={styles.grille100} d="M100 0H0V100" fill="none" />
          </pattern>
          <pattern id="hachure-erreur" width={16} height={16} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line className={styles.hachureTrait} x1={0} y1={0} x2={0} y2={16} />
          </pattern>
        </defs>
        <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="url(#grille-10)" />
        <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="url(#grille-100)" />
        <polygon className={styles.terrain} points={b.map((p) => `${p.x},${p.y}`).join(' ')} />
        {reculs(site, rules).map((l) => (
          <g key={l.key}>
            <line className={styles.recul} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
            <text
              className={styles.legendeRecul}
              x={l.tx}
              y={l.ty}
              textAnchor={l.vertical ? (l.gauche ? 'start' : 'end') : 'middle'}
            >{l.texte}</text>
          </g>
        ))}
        {autre?.rooms.map((r) => <RoomShape key={r.id} room={r} fantome />)}
        {level.rooms.map((r) => <RoomShape key={r.id} room={r} enErreur={enErreur.has(r.id)} />)}
        {selRect && (
          <rect className={styles.selection} x={selRect.x} y={selRect.y} width={selRect.w} height={selRect.h} />
        )}
      </svg>
      <div className={styles.outils} role="group" aria-label="Zoom">
        <Button variant="secondary" size="sm" aria-label="Zoom avant" onClick={() => zoomer(FACTEUR)}>+</Button>
        <Button variant="secondary" size="sm" aria-label="Zoom arrière" onClick={() => zoomer(1 / FACTEUR)}>−</Button>
        <Button variant="secondary" size="sm" aria-label="Ajuster au terrain" onClick={() => setView(ajuster(fit, ratio))}>Ajuster</Button>
      </div>
    </div>
  )
}
