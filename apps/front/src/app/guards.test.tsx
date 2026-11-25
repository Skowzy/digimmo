import { act, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
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
    const nav = screen.getByRole('navigation')
    expect(within(nav).getByRole('link', { name: 'Connexion' })).toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: 'Se déconnecter' })).not.toBeInTheDocument()
  })

  it('401 simultanés : une seule redirection et un seul vidage du cache', async () => {
    let expire = false
    server.use(
      http.get('/api/auth/me', connecte('user')),
      http.get('/api/projects', () => (expire ? non() : HttpResponse.json([]))),
    )
    const { router, queryClient } = renderApp('/projets')
    await screen.findByRole('heading', { name: 'Mes projets' })
    // Navigation lente : router.state.location reste inchangé pendant les 401 suivants.
    const original = router.navigate.bind(router)
    const navigate = vi.spyOn(router, 'navigate').mockImplementation(async (...args) => {
      await new Promise((r) => setTimeout(r, 50))
      return original(...(args as Parameters<typeof original>))
    })
    const reset = vi.spyOn(queryClient, 'removeQueries')
    expire = true
    await act(async () => {
      await Promise.all([1, 2, 3].map(() => api('/projects').catch(() => undefined)))
    })
    await screen.findByRole('heading', { name: 'Connexion' })
    // Le gestionnaire redirige une seule fois (appel avec une chaîne) ; la garde RequireAuth
    // peut aussi naviguer (appel avec un objet) maintenant que `['me']` passe à null.
    const duGestionnaire = navigate.mock.calls.filter(([to]) => typeof to === 'string')
    expect(duGestionnaire).toEqual([['/connexion?suite=%2Fprojets', { replace: true }]])
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
