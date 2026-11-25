import type { Rect } from '@digimmo/domain'
import styles from './PlanCanvas.module.css'

const MARCHE_CM = 25

/** Escalier : rectangle, marches tous les 25 cm le long du grand côté, flèche de montée et libellé « Monte ». */
export function StairsShape({ rect }: { rect: Rect }) {
  const { x, y, w, h } = rect
  const vertical = h >= w // marches parallèles au petit côté
  const longueur = vertical ? h : w
  const marches: number[] = []
  for (let d = MARCHE_CM; d < longueur; d += MARCHE_CM) marches.push(d)
  const cx = x + w / 2
  const cy = y + h / 2
  const a = Math.min(w, h) * 0.2 // demi-largeur de la pointe
  // Flèche le long du grand côté : vers le haut (vertical) ou vers la droite (horizontal).
  const fleche = vertical
    ? { tige: [cx, y + h - 20, cx, y + 20], pointe: `${cx - a},${y + 20 + a} ${cx},${y + 20} ${cx + a},${y + 20 + a}` }
    : { tige: [x + 20, cy, x + w - 20, cy], pointe: `${x + w - 20 - a},${cy - a} ${x + w - 20},${cy} ${x + w - 20 - a},${cy + a}` }
  return (
    <g className={styles.escalier} data-stairs="stairs">
      <title>Escalier</title>
      <rect className={styles.escalierRect} x={x} y={y} width={w} height={h} />
      {marches.map((d) => vertical
        ? <line key={d} className={styles.marche} x1={x} y1={y + d} x2={x + w} y2={y + d} />
        : <line key={d} className={styles.marche} x1={x + d} y1={y} x2={x + d} y2={y + h} />)}
      <line className={styles.fleche} x1={fleche.tige[0]} y1={fleche.tige[1]} x2={fleche.tige[2]} y2={fleche.tige[3]} />
      <polyline className={styles.fleche} points={fleche.pointe} fill="none" />
      <text className={styles.nom} x={cx} y={vertical ? cy + 8 : cy - 12} textAnchor="middle">Monte</text>
    </g>
  )
}
