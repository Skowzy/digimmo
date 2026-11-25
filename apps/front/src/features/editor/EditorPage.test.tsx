import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RULE_PARAMS, rectangularSite } from '@digimmo/domain'
import { server } from '../../test/server'
import { renderApp } from '../../test/render'

const me = { id: 'u1', email: 'a@b.fr', role: 'user' }
const projet = {
  id: 'p1', name: 'Alpha', site: rectangularSite(2000, 3000, 'south'), rules: DEFAULT_RULE_PARAMS,
  createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z',
}
const plan = { levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }], stairs: null }

function mock() {
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(me)),
    http.get('/api/projects/:id', () => HttpResponse.json(projet)),
    http.get('/api/projects/:id/plan', () =>
      HttpResponse.json({ plan, validation: { violations: [], checkedAt: 'x' } })),
  )
}

describe('page de l\'éditeur', () => {
  it('affiche le nom du projet, le canvas et le message écran étroit', async () => {
    mock()
    renderApp('/projets/p1')
    expect(await screen.findByRole('heading', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Plan du projet' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText("L'éditeur est prévu pour un écran d'ordinateur.")).toBeInTheDocument()
  })

  it('chargement : état annoncé', async () => {
    mock()
    renderApp('/projets/p1')
    expect(await screen.findByText('Chargement du plan…')).toHaveAttribute('role', 'status')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('le lien « Paramètres du projet » mène au formulaire', async () => {
    mock()
    const { router } = renderApp('/projets/p1')
    const lien = await screen.findByRole('link', { name: 'Paramètres du projet' })
    expect(lien).toHaveAttribute('href', '/projets/p1/parametres')
    await userEvent.click(lien)
    expect(router.state.location.pathname).toBe('/projets/p1/parametres')
    expect(await screen.findByLabelText('Largeur (m)')).toBeInTheDocument()
  })

  it('404 : message et lien vers le tableau de bord', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(me)),
      http.get('/api/projects/:id', () => HttpResponse.json({ message: 'Projet introuvable.' }, { status: 404 })),
      http.get('/api/projects/:id/plan', () => HttpResponse.json({ message: 'Projet introuvable.' }, { status: 404 })),
    )
    renderApp('/projets/zzz')
    expect(await screen.findByText('Projet introuvable.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour au tableau de bord' })).toHaveAttribute('href', '/projets')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('plan en erreur : message, Réessayer, pas d\'éditeur ; le serveur revenu, le plan s\'affiche', async () => {
    let ok = false
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(me)),
      http.get('/api/projects/:id', () => HttpResponse.json(projet)),
      http.get('/api/projects/:id/plan', () => ok
        ? HttpResponse.json({ plan, validation: { violations: [], checkedAt: 'x' } })
        : HttpResponse.json({ message: 'boum' }, { status: 500 })),
    )
    renderApp('/projets/p1')
    expect(await screen.findByText('Impossible de charger le plan.', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Plan du projet' })).not.toBeInTheDocument()
    ok = true
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('img', { name: 'Plan du projet' })).toBeInTheDocument()
  })

  it('axe', async () => {
    mock()
    const { container } = renderApp('/projets/p1')
    await screen.findByRole('img', { name: 'Plan du projet' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
