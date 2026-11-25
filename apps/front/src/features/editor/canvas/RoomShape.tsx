import { formatArea, type Room } from '@digimmo/domain'
import styles from './PlanCanvas.module.css'

type Props = { room: Room; enErreur?: boolean; fantome?: boolean }

/** Pièce : rectangle, nom et surface (police de cotes). Le fantôme est inerte. */
export function RoomShape({ room, enErreur = false, fantome = false }: Props) {
  const { x, y, w, h } = room.rect
  const cx = x + w / 2
  const cy = y + h / 2
  const classes = [styles.piece, enErreur && styles.enErreur, fantome && styles.fantome].filter(Boolean).join(' ')
  const attr = fantome ? { 'data-ghost': room.id } : { 'data-room': room.id }
  return (
    <g className={classes} {...attr}>
      <rect className={styles.pieceRect} x={x} y={y} width={w} height={h} />
      {enErreur && <rect className={styles.hachure} x={x} y={y} width={w} height={h} />}
      <text className={styles.nom} x={cx} y={cy - 6} textAnchor="middle">{room.name}</text>
      <text className={styles.surface} x={cx} y={cy + 28} textAnchor="middle">{formatArea(w * h)}</text>
    </g>
  )
}
