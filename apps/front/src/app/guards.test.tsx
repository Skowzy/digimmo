import { act, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api } from '../lib/api'
import { server } from '../test/server'
import { renderApp } from '../test/render'

const non = () => HttpResponse.json({ message: 'Non authentifié.' }, { status: 401 })
const connecte = (role: 'user' | 'admin') => () =>
  HttpResponse.json({ id: 'u1', email: 'a@b.fr', role })

describe('gardes de routes', () => {
  it('redirige un visiteur de /projets vers la connexion', async () => {
    server.use(http.get('/api/auth/me', non))
    const { router } = renderApp('/projets')
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(router.state.location.pathname + router.state.location.search).toBe('/connexion?suite=%2Fprojets')
  })

  it('ne montre pas le contenu protégé pendant le chargement', () => {
    server.use(http.get('/api/auth/me', async () => new Promise(() => {})))
    renderApp('/projets')
    expect(screen.queryByRole('heading', { name: 'Mes projets' })).not.toBeInTheDocument()
  })

  it('affiche /projets à un utilisateur connecté', async () => {
    server.use(http.get('/api/auth/me', connecte('user')))
    renderApp('/projets')
    expect(await screen.findByRole('heading', { name: 'Mes projets' })).toBeInTheDocument()
  })

  it('refuse /admin/catalogue à un utilisateur', async () => {
    server.use(http.get('/api/auth/me', connecte('user')))
    renderApp('/admin/catalogue')
    expect(await screen.findByText('Accès réservé aux administrateurs.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour au tableau de bord' })).toHaveAttribute('href', '/projets')
  })

  it('autorise /admin/catalogue à un administrateur', async () => {
    server.use(http.get('/api/auth/me', connecte('admin')))
    renderApp('/admin/catalogue')
    expect(await screen.findByRole('heading', { name: 'Catalogue' })).toBeInTheDocument()
  })

  it('session expirée : un 401 renvoie vers la connexion avec la suite', async () => {
    server.use(
      http.get('/api/auth/me', connecte('user')),
      http.get('/api/projects', non),
    )
    const { router } = renderApp('/projets')
    await screen.findByRole('heading', { name: 'Mes projets' })
    await act(async () => {
      await api('/projects').catch(() => undefined)
    })
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(router.state.location.pathname + router.state.location.search).toBe('/connexion?suite=%2Fprojets')
  })
})
