import type { Rect } from '@digimmo/domain'
import type { ResizeEdge } from '../geometry/snap'
import styles from './PlanCanvas.module.css'

const CLASSE: Record<ResizeEdge, string> = {
  n: styles.curN!, s: styles.curN!, e: styles.curE!, w: styles.curE!,
  ne: styles.curNE!, sw: styles.curNE!, nw: styles.curNW!, se: styles.curNW!,
}

/** 8 poignées de redimensionnement, dimensionnées en pixels écran (cmParPx = cm par pixel). */
export function SelectionHandles({ rect, cmParPx, taillePx = 10 }: { rect: Rect; cmParPx: number; taillePx?: number }) {
  const { x, y, w, h } = rect
  const s = Math.min(taillePx * cmParPx, Math.min(w, h) / 3) // reste de la place pour saisir la pièce
  const pos: Record<ResizeEdge, [number, number]> = {
    nw: [x, y], n: [x + w / 2, y], ne: [x + w, y],
    e: [x + w, y + h / 2], se: [x + w, y + h], s: [x + w / 2, y + h],
    sw: [x, y + h], w: [x, y + h / 2],
  }
  return (
    <g aria-hidden="true">
      {(Object.keys(pos) as ResizeEdge[]).map((k) => (
        <rect
          key={k}
          data-handle={k}
          className={`${styles.poignee} ${CLASSE[k]}`}
          x={pos[k][0] - s / 2}
          y={pos[k][1] - s / 2}
          width={s}
          height={s}
        />
      ))}
    </g>
  )
}
