import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RULE_PARAMS, rectangularSite, type Plan, type Violation } from '@digimmo/domain'
import { PlanCanvas } from './PlanCanvas'
import { EditorProvider } from '../state/EditorContext'
import { initEditor } from '../state/reducer'

const site = rectangularSite(2000, 3000, 'south')
const salon = { id: 's1', type: 'sejour' as const, name: 'Salon', rect: { x: 500, y: 500, w: 600, h: 400 } }
const plan: Plan = { levels: [{ id: 'rdc', rooms: [salon], openings: [], furniture: [] }], stairs: null }
const plan2: Plan = {
  levels: [...plan.levels, { id: 'r1', rooms: [], openings: [], furniture: [] }], stairs: null,
}

function monter(p: Plan = plan, violations: Violation[] = [], levelId: 'rdc' | 'r1' = 'rdc') {
  const initial = { ...initEditor(p, site), levelId }
  return render(
    <EditorProvider initial={initial}>
      <PlanCanvas site={site} rules={DEFAULT_RULE_PARAMS} violations={violations} />
    </EditorProvider>,
  )
}
const largeur = () => Number(screen.getByRole('img', { name: 'Plan du projet' }).getAttribute('viewBox')!.split(' ')[2])

describe('PlanCanvas', () => {
  it('rend une pièce avec son nom et sa surface', () => {
    monter()
    expect(screen.getByText('Salon')).toBeInTheDocument()
    expect(screen.getByText('24,00 m²')).toBeInTheDocument()
  })

  it('légende les lignes de recul', () => {
    monter()
    expect(screen.getByText('Recul voie 5,00 m')).toBeInTheDocument()
  })

  it('une pièce citée par une erreur porte .enErreur', () => {
    const v: Violation = { code: 'ROOM_MIN_AREA', severity: 'error', message: 'x', refs: ['s1'] }
    const { container } = monter(plan, [v])
    expect(container.querySelector('[data-room="s1"]')?.getAttribute('class')).toMatch(/enErreur/)
  })

  it('un avertissement ne marque pas la pièce', () => {
    const v: Violation = { code: 'FOOTPRINT_NEAR_MAX', severity: 'warning', message: 'x', refs: ['s1'] }
    const { container } = monter(plan, [v])
    expect(container.querySelector('[data-room="s1"]')?.getAttribute('class')).not.toMatch(/enErreur/)
  })

  it('au R+1, les pièces du RDC sont atténuées et non cliquables', () => {
    const { container } = monter(plan2, [], 'r1')
    const fantome = container.querySelector('[data-ghost="s1"]')
    expect(fantome).not.toBeNull()
    expect(fantome?.getAttribute('class')).toMatch(/fantome/)
    expect(container.querySelector('[data-room="s1"]')).toBeNull()
  })

  it('Zoom avant réduit la largeur de vue d\'un facteur 1,2', async () => {
    monter()
    const avant = largeur()
    await userEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
    expect(largeur()).toBeCloseTo(avant / 1.2, 1)
  })

  it('ne dépasse pas 800 %, ni ne descend sous 25 %', async () => {
    monter()
    const ajuste = largeur()
    for (let i = 0; i < 30; i++) await userEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
    expect(largeur()).toBeCloseTo(ajuste / 8, 1)
    for (let i = 0; i < 40; i++) await userEvent.click(screen.getByRole('button', { name: 'Zoom arrière' }))
    expect(largeur()).toBeCloseTo(ajuste * 4, 1)
  })

  it('Ajuster au terrain revient à la vue initiale', async () => {
    monter()
    const initiale = screen.getByRole('img', { name: 'Plan du projet' }).getAttribute('viewBox')
    await userEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ajuster au terrain' }))
    expect(screen.getByRole('img', { name: 'Plan du projet' }).getAttribute('viewBox')).toBe(initiale)
  })
})
