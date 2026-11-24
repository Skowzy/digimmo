import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import type { Plan, Violation } from '@digimmo/domain'
import { DEFAULT_RULE_PARAMS, rectangularSite } from '@digimmo/domain'
import type { ProjectDto } from '../lib/queries'
import { ProjectCard } from './ProjectCard'

const project: ProjectDto = {
  id: 'p1',
  name: 'Maison Dupont',
  site: rectangularSite(2000, 3000, 'south'),
  rules: DEFAULT_RULE_PARAMS,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: new Date().toISOString(),
}
const plan: Plan = {
  levels: [{ id: 'rdc', rooms: [{ id: 'r', type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 1000, h: 1120 } }], openings: [], furniture: [] }],
  stairs: null,
}
const v = (code: Violation['code'], severity: Violation['severity']): Violation => ({ code, severity, message: 'm', refs: [] })

const rendre = (violations?: Violation[], onDelete?: () => void, planState?: 'loading' | 'error' | 'ok') =>
  render(<MemoryRouter><ProjectCard project={project} plan={planState === 'ok' || !planState ? plan : undefined} violations={violations} planState={planState} onDelete={onDelete} /></MemoryRouter>)

describe('ProjectCard', () => {
  it('nom en lien, surfaces et date', () => {
    rendre([])
    expect(screen.getByRole('link', { name: 'Maison Dupont' })).toHaveAttribute('href', '/projets/p1')
    expect(screen.getByText('Terrain 600,00 m² · Maison 112,00 m²')).toBeInTheDocument()
    expect(screen.getByText("modifié à l'instant")).toBeInTheDocument()
  })
  it('sans erreur : Valide', () => {
    rendre([])
    expect(screen.getByText('Valide')).toBeInTheDocument()
  })
  it('alertes seules', () => {
    rendre([v('FOOTPRINT_NEAR_MAX', 'warning')])
    expect(screen.getByText('1 alerte')).toBeInTheDocument()
  })
  it('erreurs', () => {
    rendre([v('ROOM_OVERLAP', 'error'), v('ROOM_OVERLAP', 'error'), v('FOOTPRINT_NEAR_MAX', 'warning')])
    expect(screen.getByText('2 erreurs')).toBeInTheDocument()
  })
  it('TOO_MANY_VIOLATIONS : 200+ erreurs', () => {
    rendre([v('ROOM_OVERLAP', 'error'), v('TOO_MANY_VIOLATIONS', 'warning')])
    expect(screen.getByText('200+ erreurs')).toBeInTheDocument()
  })
  it('chargement : Maison — et pas de pastille', () => {
    rendre(undefined, undefined, 'loading')
    expect(screen.getByText('Terrain 600,00 m² · Maison —')).toBeInTheDocument()
    expect(screen.queryByText('Valide')).not.toBeInTheDocument()
  })
  it('erreur du plan : Aperçu indisponible, ni surface maison ni Valide', () => {
    rendre(undefined, undefined, 'error')
    expect(screen.getByText('Aperçu indisponible')).toBeInTheDocument()
    expect(screen.queryByText('Valide')).not.toBeInTheDocument()
    expect(screen.queryByText(/· Maison/)).not.toBeInTheDocument()
  })
  it('Supprimer appelle onDelete', async () => {
    const onDelete = vi.fn()
    rendre([], onDelete)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer Maison Dupont' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
  it('sans violation axe', async () => {
    const { container } = rendre([])
    expect(await axe(container)).toHaveNoViolations()
  })
})
