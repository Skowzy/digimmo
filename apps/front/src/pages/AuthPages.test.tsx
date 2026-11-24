import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderApp } from '../test/render'

const visiteur = () => HttpResponse.json({ message: 'Non authentifié.' }, { status: 401 })
const user = { id: 'u1', email: 'a@b.fr', role: 'user' }
const MSG_FORGOT = "Si un compte existe pour cette adresse, un e-mail vient d'être envoyé."

function avecVisiteur() {
  server.use(http.get('/api/auth/me', visiteur))
}

describe('connexion', () => {
  it('affiche Identifiants invalides sur 401', async () => {
    avecVisiteur()
    server.use(http.post('/api/auth/login', () => HttpResponse.json({ message: 'Identifiants invalides.' }, { status: 401 })))
    renderApp('/connexion')
    await userEvent.type(await screen.findByLabelText('Adresse e-mail'), 'a@b.fr')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret-secret')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Identifiants invalides.')
  })

  it.each([
    ['%2Fprojets%2Fabc', '/projets/abc'],
    ['https%3A%2F%2Fevil.example', '/projets'],
    ['%2F%5Cevil.com', '/projets'],
  ])('suite=%s redirige vers %s', async (suite, attendu) => {
    avecVisiteur()
    server.use(http.post('/api/auth/login', () => HttpResponse.json(user)))
    const { router } = renderApp(`/connexion?suite=${suite}`)
    await userEvent.type(await screen.findByLabelText('Adresse e-mail'), 'a@b.fr')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret-secret')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(attendu))
  })

  it('propose le lien mot de passe oublié', async () => {
    avecVisiteur()
    renderApp('/connexion')
    expect(await screen.findByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute('href', '/mot-de-passe-oublie')
  })

  it('focalise le premier champ invalide', async () => {
    avecVisiteur()
    renderApp('/connexion')
    await userEvent.click(await screen.findByRole('button', { name: 'Se connecter' }))
    await waitFor(() => expect(screen.getByLabelText('Adresse e-mail')).toHaveFocus())
  })

  it('sans violation axe', async () => {
    avecVisiteur()
    const { container } = renderApp('/connexion')
    await screen.findByLabelText('Adresse e-mail')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('inscription', () => {
  async function remplir(email: string, mdp: string, conf: string) {
    await userEvent.type(await screen.findByLabelText('Adresse e-mail'), email)
    await userEvent.type(screen.getByLabelText('Mot de passe'), mdp)
    await userEvent.type(screen.getByLabelText('Confirmation du mot de passe'), conf)
    await userEvent.click(screen.getByRole('button', { name: "S'inscrire" }))
  }

  it('refuse 9 caractères sans requête', async () => {
    avecVisiteur()
    let appels = 0
    server.use(http.post('/api/auth/register', () => { appels++; return HttpResponse.json(user, { status: 201 }) }))
    renderApp('/inscription')
    await remplir('a@b.fr', '123456789', '123456789')
    expect(await screen.findByText('10 caractères minimum.')).toBeInTheDocument()
    expect(appels).toBe(0)
    expect(screen.getByLabelText('Mot de passe')).toHaveFocus()
  })

  it('refuse une confirmation différente', async () => {
    avecVisiteur()
    renderApp('/inscription')
    await remplir('a@b.fr', '1234567890', '1234567891')
    expect(await screen.findByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument()
  })

  it('affiche le message du 409', async () => {
    avecVisiteur()
    server.use(http.post('/api/auth/register', () => HttpResponse.json({ message: 'Un compte existe déjà avec cette adresse.' }, { status: 409 })))
    renderApp('/inscription')
    await remplir('a@b.fr', '1234567890', '1234567890')
    expect(await screen.findByRole('alert')).toHaveTextContent('Un compte existe déjà avec cette adresse.')
  })

  it("affiche l'issue 400 sous le champ e-mail", async () => {
    avecVisiteur()
    server.use(http.post('/api/auth/register', () => HttpResponse.json({ message: 'Données invalides.', issues: ['email: Adresse e-mail invalide'] }, { status: 400 })))
    renderApp('/inscription')
    await remplir('a@b.fr', '1234567890', '1234567890')
    expect(await screen.findByText('Adresse e-mail invalide')).toBeInTheDocument()
    expect(screen.queryByText(/object Object/)).not.toBeInTheDocument()
  })

  it('redirige vers /projets en cas de succès', async () => {
    avecVisiteur()
    server.use(http.post('/api/auth/register', () => HttpResponse.json(user, { status: 201 })))
    const { router } = renderApp('/inscription')
    await remplir('a@b.fr', '1234567890', '1234567890')
    await waitFor(() => expect(router.state.location.pathname).toBe('/projets'))
  })

  it('sans violation axe', async () => {
    avecVisiteur()
    const { container } = renderApp('/inscription')
    await screen.findByLabelText('Adresse e-mail')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('mot de passe oublié', () => {
  it('affiche le message du serveur et masque le formulaire', async () => {
    avecVisiteur()
    server.use(http.post('/api/auth/password/forgot', () => HttpResponse.json({ message: MSG_FORGOT }, { status: 202 })))
    renderApp('/mot-de-passe-oublie')
    await userEvent.type(await screen.findByLabelText('Adresse e-mail'), 'inconnu@b.fr')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))
    expect(await screen.findByRole('status')).toHaveTextContent(MSG_FORGOT)
    expect(screen.queryByLabelText('Adresse e-mail')).not.toBeInTheDocument()
  })

  it('sans violation axe', async () => {
    avecVisiteur()
    const { container } = renderApp('/mot-de-passe-oublie')
    await screen.findByLabelText('Adresse e-mail')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('réinitialisation', () => {
  it("retire le jeton de l'URL, l'envoie et pose no-referrer", async () => {
    avecVisiteur()
    let corps: unknown
    server.use(http.post('/api/auth/password/reset', async ({ request }) => { corps = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    const { router } = renderApp('/mot-de-passe/reinitialiser?token=abc')
    await userEvent.type(await screen.findByLabelText('Nouveau mot de passe'), '1234567890')
    await userEvent.type(screen.getByLabelText('Confirmation du mot de passe'), '1234567890')
    expect(window.location.search).not.toContain('abc')
    expect(router.state.location.search).not.toContain('abc')
    expect(document.head.querySelector('meta[name="referrer"][content="no-referrer"]')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'))
    expect(corps).toEqual({ token: 'abc', password: '1234567890' })
    expect(await screen.findByText('Mot de passe modifié. Connectez-vous.')).toBeInTheDocument()
    expect(document.head.querySelector('meta[name="referrer"]')).toBeNull()
  })

  it('affiche Lien invalide ou expiré sur 400', async () => {
    avecVisiteur()
    server.use(http.post('/api/auth/password/reset', () => HttpResponse.json({ message: 'Lien invalide ou expiré.' }, { status: 400 })))
    renderApp('/mot-de-passe/reinitialiser?token=abc')
    await userEvent.type(await screen.findByLabelText('Nouveau mot de passe'), '1234567890')
    await userEvent.type(screen.getByLabelText('Confirmation du mot de passe'), '1234567890')
    await userEvent.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Lien invalide ou expiré.')
  })

  it('sans jeton, propose de redemander un lien', async () => {
    avecVisiteur()
    renderApp('/mot-de-passe/reinitialiser')
    expect(await screen.findByRole('alert')).toHaveTextContent('Lien invalide ou expiré.')
    expect(screen.getByRole('link', { name: /mot de passe oublié/i })).toHaveAttribute('href', '/mot-de-passe-oublie')
    expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument()
  })

  it('sans violation axe', async () => {
    avecVisiteur()
    const { container } = renderApp('/mot-de-passe/reinitialiser?token=abc')
    await screen.findByLabelText('Nouveau mot de passe')
    expect(await axe(container)).toHaveNoViolations()
  })
})
