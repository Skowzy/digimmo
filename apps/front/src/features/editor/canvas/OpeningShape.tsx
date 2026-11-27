import { doorHinge, doorSwingRect, type Opening } from '@digimmo/domain'
import styles from './PlanCanvas.module.css'

type Props = { opening: Opening; enErreur?: boolean; selectionnee?: boolean; start?: number }

const EPAISSEUR_TROU = 16 // cm : l'ouverture « troue » le trait du mur
const ECART_VITRE = 4

/** Porte (trou, vantail, arc d'un quart de cercle) ou fenêtre (trou, double trait fin). */
export function OpeningShape({ opening, enErreur = false, selectionnee = false, start }: Props) {
  const o = start === undefined ? opening : { ...opening, start }
  const h = o.orientation === 'h'
  const pt = (a: number, p: number) => (h ? { x: a, y: p } : { x: p, y: a })
  const a = pt(o.start, o.fixed)
  const b = pt(o.start + o.width, o.fixed)
  const classes = [styles.ouverture, enErreur && styles.enErreur].filter(Boolean).join(' ')
  const contour = o.kind === 'door' ? doorSwingRect(o)
    : h ? { x: o.start, y: o.fixed - 10, w: o.width, h: 20 } : { x: o.fixed - 10, y: o.start, w: 20, h: o.width }
  let corps
  if (o.kind === 'door' && o.swing) {
    const hinge = doorHinge(o)
    const s = o.swing.side === 'neg' ? -1 : 1
    const d = o.swing.hinge === 'end' ? -1 : 1
    const n = h ? { x: 0, y: s } : { x: s, y: 0 }
    const dir = h ? { x: d, y: 0 } : { x: 0, y: d }
    const feuille = { x: hinge.x + n.x * o.width, y: hinge.y + n.y * o.width }
    const autre = { x: hinge.x + dir.x * o.width, y: hinge.y + dir.y * o.width }
    const sweep = n.x * dir.y - n.y * dir.x > 0 ? 1 : 0
    corps = (
      <>
        <line className={styles.vantail} x1={hinge.x} y1={hinge.y} x2={feuille.x} y2={feuille.y} />
        <path data-arc className={styles.arc} d={`M ${feuille.x} ${feuille.y} A ${o.width} ${o.width} 0 0 ${sweep} ${autre.x} ${autre.y}`} />
      </>
    )
  } else {
    const l = (e: number) => {
      const p = pt(o.start, o.fixed + e), q = pt(o.start + o.width, o.fixed + e)
      return <line key={e} data-vitre className={styles.vitre} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
    }
    corps = <>{l(-ECART_VITRE)}{l(ECART_VITRE)}</>
  }
  return (
    <g className={classes} data-opening={o.id}>
      <line className={styles.trou} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={EPAISSEUR_TROU} />
      {corps}
      <line className={styles.zoneTouche} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {enErreur && <rect data-hachure className={styles.hachure} x={contour.x} y={contour.y} width={contour.w} height={contour.h} />}
      {selectionnee && <rect data-contour className={styles.contour} x={contour.x} y={contour.y} width={contour.w} height={contour.h} />}
    </g>
  )
}
