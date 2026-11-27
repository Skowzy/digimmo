import { furnitureFootprint, type Furniture } from '@digimmo/domain'
import styles from './PlanCanvas.module.css'

type Props = { furniture: Furniture; enErreur?: boolean; selectionnee?: boolean }

const CORPS_MAX = 20 // cm : hauteur maximale du libellé
const LARGEUR_CAR = 0.55 // largeur moyenne d'un caractère, en fraction de la hauteur

/** Libellé tronqué (avec « … ») pour tenir dans `largeur` cm. */
function abreger(label: string, largeur: number, corps: number): string {
  const max = Math.floor((largeur - 8) / (corps * LARGEUR_CAR))
  if (label.length <= max) return label
  return max < 2 ? '' : `${label.slice(0, max - 1)}…`
}

/** Meuble : empreinte en trait fin (la rotation est portée par l'empreinte) et libellé abrégé centré. */
export function FurnitureShape({ furniture, enErreur = false, selectionnee = false }: Props) {
  const r = furnitureFootprint(furniture)
  const corps = Math.min(CORPS_MAX, r.h / 3)
  const classes = [styles.meuble, enErreur && styles.enErreur].filter(Boolean).join(' ')
  return (
    <g className={classes} data-furniture={furniture.id}>
      <title>{furniture.label}</title>
      <rect className={styles.meubleRect} x={r.x} y={r.y} width={r.w} height={r.h} />
      <text className={styles.meubleLibelle} x={r.x + r.w / 2} y={r.y + r.h / 2} fontSize={corps} textAnchor="middle" dominantBaseline="central">
        {abreger(furniture.label, r.w, corps)}
      </text>
      {enErreur && <rect data-hachure className={styles.hachure} x={r.x} y={r.y} width={r.w} height={r.h} />}
      {selectionnee && <rect data-contour className={styles.contour} x={r.x} y={r.y} width={r.w} height={r.h} />}
    </g>
  )
}
