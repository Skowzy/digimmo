import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RULE_PARAMS, rectangularSite } from '@digimmo/domain'
import { server } from '../test/server'
import { renderApp } from '../test/render'

const me = { id: 'u1', email: 'a@b.fr', role: 'user' }
const projet = (id: string, name: string) => ({
  id, name, site: rectangularSite(2000, 3000, 'south'), rules: DEFAULT_RULE_PARAMS,
  createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z',
})
const plan = {
  levels: [{ id: 'rdc', rooms: [{ id: 'r', type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 1000, h: 1120 } }], openings: [], furniture: [] }],
  stairs: null,
}
const err = (n: number) => Array.from({ length: n }, () => ({ code: 'ROOM_OVERLAP', severity: 'error', message: 'm', refs: [] }))

function mock(projets: unknown[], violationsParId: Record<string, unknown[]> = {}) {
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(me)),
    http.get('/api/projects', () => HttpResponse.json(projets)),
    http.get('/api/projects/:id/plan', ({ params }) =>
      HttpResponse.json({ plan, validation: { violations: violationsParId[params.id as string] ?? [], checkedAt: '2026-11-20T10:00:00Z' } }),
    ),
  )
}

describe('tableau de bord', () => {
  it('deux cartes dans l\'ordre de l\'API, pastilles et surfaces', async () => {
    mock([projet('a', 'Alpha'), projet('b', 'Beta')], { a: err(2) })
    renderApp('/projets')
    const liens = await screen.findAllByRole('link', { name: /Alpha|Beta/ })
    expect(liens.map((l) => l.textContent)).toEqual(['Alpha', 'Beta'])
    expect(liens.map((l) => l.getAttribute('href'))).toEqual(['/projets/a', '/projets/b'])
    expect(await screen.findByText('2 erreurs')).toBeInTheDocument()
    expect(await screen.findByText('Aucun problème')).toBeInTheDocument()
    expect((await screen.findAllByText('Terrain 600,00 m² · Maison 112,00 m²'))).toHaveLength(2)
  })

  it('liste vide : état vide et bouton Nouveau projet', async () => {
    mock([])
    renderApp('/projets')
    expect(await screen.findByText('Aucun projet pour l\'instant.')).toBeInTheDocument()
    const liens = screen.getAllByRole('link', { name: 'Nouveau projet' })
    expect(liens.length).toBe(2)
    liens.forEach((l) => expect(l).toHaveAttribute('href', '/projets/nouveau'))
  })

  it('erreur de chargement : alerte', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(me)),
      http.get('/api/projects', () => HttpResponse.json({ message: 'Boum.' }, { status: 500 })),
    )
    renderApp('/projets')
    expect(await screen.findByRole('alert')).toHaveTextContent('Boum.')
  })

  it('Annuler la suppression : aucune requête', async () => {
    let deletes = 0
    mock([projet('a', 'Alpha')])
    server.use(http.delete('/api/projects/:id', () => { deletes++; return new HttpResponse(null, { status: 204 }) }))
    renderApp('/projets')
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer Alpha' }))
    const dialogue = screen.getByRole('dialog')
    expect(dialogue).toHaveTextContent('Supprimer le projet « Alpha » ? Cette action est définitive.')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(deletes).toBe(0)
    expect(screen.getByRole('link', { name: 'Alpha' })).toBeInTheDocument()
  })

  it('confirmer : DELETE puis la carte disparaît', async () => {
    let projets = [projet('a', 'Alpha'), projet('b', 'Beta')]
    const supprimes: string[] = []
    const plansDemandes: string[] = []
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(me)),
      http.get('/api/projects', () => HttpResponse.json(projets)),
      http.get('/api/projects/:id/plan', ({ params }) => {
        plansDemandes.push(params.id as string)
        return HttpResponse.json({ plan, validation: { violations: [], checkedAt: 'x' } })
      }),
      http.delete('/api/projects/:id', ({ params }) => {
        supprimes.push(params.id as string)
        projets = projets.filter((p) => p.id !== params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderApp('/projets')
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer Alpha' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Alpha' })).not.toBeInTheDocument())
    expect(supprimes).toEqual(['a'])
    expect(plansDemandes.filter((id) => id === 'a')).toHaveLength(1) // seulement le chargement initial
    // le focus ne tombe pas sur <body> : il va au titre de la page
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Mes projets' }))
    expect(screen.getByRole('link', { name: 'Beta' })).toBeInTheDocument()
  })

  it('plan en erreur : carte signalée, pas de Valide', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(me)),
      http.get('/api/projects', () => HttpResponse.json([projet('a', 'Alpha')])),
      http.get('/api/projects/:id/plan', () => HttpResponse.json({ message: 'x' }, { status: 500 })),
    )
    renderApp('/projets')
    expect(await screen.findByText('Aperçu indisponible')).toBeInTheDocument()
    expect(screen.queryByText('Aucun problème')).not.toBeInTheDocument()
  })

  it('sans violation axe', async () => {
    mock([projet('a', 'Alpha')])
    const { container } = renderApp('/projets')
    await screen.findByText('Aucun problème')
    expect(await axe(container)).toHaveNoViolations()
  })
})
