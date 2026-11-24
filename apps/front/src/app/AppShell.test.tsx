import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderApp } from '../test/render'

const AVERTISSEMENT = 'Digimmo ne remplace ni un architecte ni un constructeur. Les plans sont indicatifs.'

describe('AppShell', () => {
  it('connecté : se déconnecter appelle logout puis affiche « Connexion »', async () => {
    let logout = 0
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ id: 'u1', email: 'a@b.fr', role: 'user' })),
      http.post('/api/auth/logout', () => {
        logout++
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderApp('/projets')
    const bouton = await screen.findByRole('button', { name: 'Se déconnecter' })
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ message: 'Non authentifié.' }, { status: 401 })))
    await userEvent.click(bouton)
    await waitFor(() => expect(logout).toBe(1))
    expect(await screen.findByRole('link', { name: 'Connexion' })).toBeInTheDocument()
  })

  it('déconnexion en échec : la session est tout de même réinitialisée localement', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ id: 'u1', email: 'a@b.fr', role: 'user' })),
      http.get('/api/projects', () => HttpResponse.json([])),
      http.post('/api/auth/logout', () => HttpResponse.json({ message: 'Boum.' }, { status: 500 })),
    )
    renderApp('/projets')
    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    const nav = screen.getByRole('navigation')
    expect(await within(nav).findByRole('link', { name: 'Connexion' })).toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: 'Se déconnecter' })).not.toBeInTheDocument()
  })

  it('affiche les liens connecté et le lien Catalogue pour un admin', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ id: 'u1', email: 'a@b.fr', role: 'admin' })))
    renderApp('/projets')
    expect(await screen.findByRole('link', { name: 'Mes projets' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Mon compte' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Catalogue' })).toBeInTheDocument()
  })

  it('visiteur : Connexion et Créer un compte, avertissement, lien d’évitement', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ message: 'Non authentifié.' }, { status: 401 })))
    renderApp('/')
    const nav = within(screen.getByRole('navigation', { name: 'Navigation principale' }))
    expect(await nav.findByRole('link', { name: 'Créer un compte' })).toBeInTheDocument()
    expect(nav.getByRole('link', { name: 'Connexion' })).toBeInTheDocument()
    expect(within(screen.getByRole('contentinfo')).getByText(AVERTISSEMENT)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveAttribute('href', '#contenu')
    expect(screen.getByRole('link', { name: 'DIGIMMO' })).toHaveAttribute('href', '/')
  })

  it('n’a aucune violation axe', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ id: 'u1', email: 'a@b.fr', role: 'user' })))
    const { container } = renderApp('/projets')
    await screen.findByRole('button', { name: 'Se déconnecter' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
