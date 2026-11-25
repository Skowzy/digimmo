import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import type { Plan, Site } from '@digimmo/domain'
import { PlanThumbnail } from './PlanThumbnail'

const site: Site = {
  boundary: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 3000 }, { x: 0, y: 3000 }],
  streetEdge: 0,
}
const plan: Plan = {
  levels: [{ id: 'rdc', rooms: [{ id: 'r', type: 'sejour', name: 'Séjour', rect: { x: 500, y: 500, w: 800, h: 1000 } }], openings: [], furniture: [] }],
  stairs: null,
}

function bbox(points: string) {
  const pts = points.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number])
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), minX: Math.min(...xs), minY: Math.min(...ys) }
}

describe('PlanThumbnail', () => {
  it('terrain 2000×3000 dans 190×80 : ratio 2:3 conservé, avec marge de 4 px', () => {
    const { container } = render(<PlanThumbnail site={site} plan={plan} />)
    expect(screen.getByRole('img', { name: 'Aperçu du plan' })).toBeInTheDocument()
    const b = bbox(container.querySelector('[data-role="terrain"]')!.getAttribute('points')!)
    expect(b.w / b.h).toBeCloseTo(2 / 3, 5)
    expect(b.h).toBeCloseTo(72, 5)
    expect(b.minY).toBeCloseTo(4, 5)
  })

  it('dessine les pièces du RDC', () => {
    const { container } = render(<PlanThumbnail site={site} plan={plan} />)
    expect(container.querySelectorAll('[data-role="piece"]')).toHaveLength(1)
  })

  it('sans plan : terrain seul', () => {
    const { container } = render(<PlanThumbnail site={site} />)
    expect(container.querySelectorAll('[data-role="piece"]')).toHaveLength(0)
  })

  it('sans violation axe', async () => {
    const { container } = render(<PlanThumbnail site={site} plan={plan} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
