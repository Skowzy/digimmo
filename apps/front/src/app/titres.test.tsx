import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderApp } from '../test/render'

const non = () => HttpResponse.json({ message: 'Non authentifié.' }, { status: 401 })

describe('titres de page', () => {
  it("l'accueil s'intitule « Digimmo »", async () => {
    server.use(http.get('/api/auth/me', non))
    renderApp('/')
    await screen.findByRole('heading', { level: 1 })
    expect(document.title).toBe('Digimmo')
  })

  it('la connexion : « Connexion · Digimmo »', async () => {
    server.use(http.get('/api/auth/me', non))
    renderApp('/connexion')
    await screen.findByRole('heading', { name: 'Connexion' })
    expect(document.title).toBe('Connexion · Digimmo')
  })

  it('le tableau de bord puis le compte changent le titre', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ id: 'u1', email: 'a@b.fr', role: 'user' })),
      http.get('/api/projects', () => HttpResponse.json([])),
    )
    const { router } = renderApp('/projets')
    await screen.findByRole('heading', { name: 'Mes projets' })
    expect(document.title).toBe('Mes projets · Digimmo')
    await router.navigate('/compte')
    await screen.findByRole('heading', { name: 'Mon compte' })
    expect(document.title).toBe('Mon compte · Digimmo')
  })

  it('page introuvable', async () => {
    server.use(http.get('/api/auth/me', non))
    renderApp('/nimporte-quoi')
    await screen.findByRole('heading', { name: 'Page introuvable' })
    expect(document.title).toBe('Page introuvable · Digimmo')
  })
})
