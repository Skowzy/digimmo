import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderApp } from '../test/render'

const AVERTISSEMENT = 'Digimmo ne remplace ni un architecte ni un constructeur. Les plans sont indicatifs.'
const visiteur = () =>
  server.use(http.get('/api/auth/me', () => HttpResponse.json({ message: 'Non authentifié.' }, { status: 401 })))
const connecte = () =>
  server.use(http.get('/api/auth/me', () => HttpResponse.json({ id: 'u1', email: 'a@b.fr', role: 'user' })))

describe('page d’accueil', () => {
  it('visiteur : titre, boutons « Créer un compte » et « Se connecter »', async () => {
    visiteur()
    renderApp('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Agencez votre future maison, pièce par pièce.' })).toBeInTheDocument()
    const main = within(screen.getByRole('main'))
    expect(await main.findByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/inscription')
    expect(main.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/connexion')
    expect(main.queryByRole('link', { name: 'Mes projets' })).not.toBeInTheDocument()
  })

  it('connecté : bouton « Mes projets » à la place des liens d’authentification', async () => {
    connecte()
    renderApp('/')
    const main = within(screen.getByRole('main'))
    expect(await main.findByRole('link', { name: 'Mes projets' })).toHaveAttribute('href', '/projets')
    expect(main.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument()
    expect(main.queryByRole('link', { name: 'Créer un compte' })).not.toBeInTheDocument()
  })

  it('visiteur, session en cours de vérification : aucun bouton connecté affiché', () => {
    server.use(http.get('/api/auth/me', async () => new Promise<never>(() => {})))
    renderApp('/')
    expect(within(screen.getByRole('main')).queryByRole('link')).not.toBeInTheDocument()
  })

  it('affiche l’avertissement dans la page', () => {
    visiteur()
    renderApp('/')
    expect(screen.getByRole('main')).toHaveTextContent(AVERTISSEMENT)
  })

  it('n’a aucune violation axe', async () => {
    visiteur()
    const { container } = renderApp('/')
    await screen.findByRole('link', { name: 'Se connecter' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
