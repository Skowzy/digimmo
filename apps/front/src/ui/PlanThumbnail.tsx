import type { Plan, Site } from '@digimmo/domain'

const MARGE = 4

type Props = { site: Site; plan?: Plan; width?: number; height?: number }

export function PlanThumbnail({ site, plan, width = 190, height = 80 }: Props) {
  const xs = site.boundary.map((p) => p.x)
  const ys = site.boundary.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const bw = Math.max(...xs) - minX || 1
  const bh = Math.max(...ys) - minY || 1
  const echelle = Math.min((width - 2 * MARGE) / bw, (height - 2 * MARGE) / bh)
  const dx = (width - bw * echelle) / 2
  const dy = (height - bh * echelle) / 2
  const px = (x: number) => dx + (x - minX) * echelle
  const py = (y: number) => dy + (y - minY) * echelle
  const points = site.boundary.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')
  const pieces = plan?.levels.find((l) => l.id === 'rdc')?.rooms ?? []

  return (
    <svg role="img" aria-label="Aperçu du plan" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ color: 'var(--encre)' }}>
      <polygon data-role="terrain" points={points} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="4 3" />
      {pieces.map((r) => (
        <rect
          key={r.id}
          data-role="piece"
          x={px(r.rect.x)}
          y={py(r.rect.y)}
          width={r.rect.w * echelle}
          height={r.rect.h * echelle}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
        />
      ))}
    </svg>
  )
}
