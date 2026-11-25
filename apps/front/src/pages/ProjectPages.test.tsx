import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RULE_PARAMS, rectangularSite } from '@digimmo/domain'
import { server } from '../test/server'
import { renderApp } from '../test/render'

const me = { id: 'u1', email: 'a@b.fr', role: 'user' }
const projet = {
  id: 'p1', name: 'Alpha', site: rectangularSite(2000, 3000, 'south'), rules: DEFAULT_RULE_PARAMS,
  createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z',
}
const plan = { levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }], stairs: null }
const v = (severity: string, message: string, code = 'ROOM_OVERLAP') => ({ code, severity, message, refs: [] })

function mockProjet(violations: unknown[]) {
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(me)),
    http.get('/api/projects/:id', () => HttpResponse.json(projet)),
    http.get('/api/projects/:id/plan', () =>
      HttpResponse.json({ plan, validation: { violations, checkedAt: '2026-11-20T10:00:00Z' } })),
  )
}

describe('nouveau projet', () => {
  it('succès : POST puis navigation vers le projet renvoyé', async () => {
    let corps: unknown
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(me)),
      http.post('/api/projects', async ({ request }) => { corps = await request.json(); return HttpResponse.json({ ...projet, id: 'nouveau-id' }, { status: 201 }) }),
      http.get('/api/projects/:id', () => HttpResponse.json({ ...projet, id: 'nouveau-id' })),
      http.get('/api/projects/:id/plan', () => HttpResponse.json({ plan, validation: { violations: [], checkedAt: 'x' } })),
    )
    const { router } = renderApp('/projets/nouveau')
    await userEvent.type(await screen.findByLabelText('Nom du projet'), 'Maison')
    await userEvent.type(screen.getByLabelText('Largeur (m)'), '20')
    await userEvent.type(screen.getByLabelText('Profondeur (m)'), '30')
    await userEvent.click(screen.getByRole('button', { name: 'Créer le projet' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projets/nouveau-id'))
    expect(corps).toMatchObject({ name: 'Maison', terrain: { widthCm: 2000, depthCm: 3000, street: 'north' }, rules: DEFAULT_RULE_PARAMS })
  })

  it('400 avec issues : affichées', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(me)),
      http.post('/api/projects', () => HttpResponse.json({ message: 'Données invalides.', issues: ['name: déjà pris', 'divers: oups'] }, { status: 400 })),
    )
    renderApp('/projets/nouveau')
    await userEvent.type(await screen.findByLabelText('Nom du projet'), 'Maison')
    await userEvent.type(screen.getByLabelText('Largeur (m)'), '20')
    await userEvent.type(screen.getByLabelText('Profondeur (m)'), '30')
    await userEvent.click(screen.getByRole('button', { name: 'Créer le projet' }))
    expect(await screen.findByText('déjà pris')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('divers: oups')
  })

  it('axe', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(me)))
    const { container } = renderApp('/projets/nouveau')
    await screen.findByLabelText('Nom du projet')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('page projet', () => {
  it('violations : erreurs puis alertes, messages serveur, formulaire prérempli', async () => {
    mockProjet([v('warning', 'Alerte A', 'FOOTPRINT_NEAR_MAX'), v('warning', 'Trop', 'TOO_MANY_VIOLATIONS'), v('error', 'Erreur B'), v('warning', 'Alerte C', 'ROOM_MIN_AREA')])
    renderApp('/projets/p1')
    expect(await screen.findByRole('heading', { name: 'Alpha' })).toBeInTheDocument()
    expect(await screen.findByText('Erreur B')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem').map((l) => l.textContent ?? '')
    const ordre = ['Erreur B', 'Alerte A', 'Alerte C', 'Trop'].map((t) => items.findIndex((i) => i.includes(t)))
    expect(ordre).toEqual([...ordre].sort((a, b) => a - b))
    expect(ordre.every((i) => i >= 0)).toBe(true)
    expect(screen.getByText('L\'éditeur arrive bientôt')).toBeInTheDocument()
    expect(screen.getByLabelText('Largeur (m)')).toHaveValue('20,00')
    expect(screen.getByLabelText('Profondeur (m)')).toHaveValue('30,00')
    expect(screen.getByLabelText('Côté de la voie')).toHaveValue('south')
  })

  it('aucune violation', async () => {
    mockProjet([])
    renderApp('/projets/p1')
    expect(await screen.findByText('Aucun problème détecté')).toBeInTheDocument()
  })

  it('modifier le recul : PATCH en cm puis liste rechargée', async () => {
    let violations: unknown[] = [v('error', 'Avant')]
    let corps: { rules?: { setbackStreetCm?: number } } = {}
    mockProjet([])
    server.use(
      http.get('/api/projects/:id/plan', () => HttpResponse.json({ plan, validation: { violations, checkedAt: 'x' } })),
      http.patch('/api/projects/:id', async ({ request }) => { corps = (await request.json()) as typeof corps; violations = [v('error', 'Après')]; return HttpResponse.json(projet) }),
    )
    renderApp('/projets/p1')
    expect(await screen.findByText('Avant')).toBeInTheDocument()
    const champ = await screen.findByLabelText('Recul sur voie (m)')
    await userEvent.clear(champ)
    await userEvent.type(champ, '6,5')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Paramètres enregistrés.')).toBeInTheDocument()
    expect(corps.rules?.setbackStreetCm).toBe(650)
    expect(await screen.findByText('Après')).toBeInTheDocument()
  })

  it('enregistrement : le focus passe sur le message de succès (le formulaire est remonté)', async () => {
    let courant = projet
    mockProjet([])
    server.use(
      http.get('/api/projects/:id', () => HttpResponse.json(courant)),
      http.patch('/api/projects/:id', () => {
        courant = { ...projet, updatedAt: '2026-11-24T12:00:00Z' }
        return HttpResponse.json(courant)
      }),
    )
    renderApp('/projets/p1')
    const champ = await screen.findByLabelText('Recul sur voie (m)')
    await userEvent.clear(champ)
    await userEvent.type(champ, '6')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    const alerte = await screen.findByText('Paramètres enregistrés.')
    await waitFor(() => expect(document.activeElement).toBe(alerte.closest('[role="status"]')))
    expect(document.activeElement).toHaveTextContent('Paramètres enregistrés.')
  })

  it('après le succès, une actualisation ultérieure du projet ne vole pas le focus', async () => {
    let courant = projet
    mockProjet([])
    server.use(
      http.get('/api/projects/:id', () => HttpResponse.json(courant)),
      http.patch('/api/projects/:id', () => {
        courant = { ...projet, updatedAt: '2026-11-24T12:00:00Z' }
        return HttpResponse.json(courant)
      }),
    )
    const { queryClient } = renderApp('/projets/p1')
    const champ = await screen.findByLabelText('Recul sur voie (m)')
    await userEvent.clear(champ)
    await userEvent.type(champ, '6')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    const alerte = await screen.findByText('Paramètres enregistrés.')
    await waitFor(() => expect(document.activeElement).toBe(alerte.closest('[role="status"]')))
    // L'utilisateur reprend la saisie, puis le projet est modifié ailleurs et rechargé.
    const nom = screen.getByLabelText('Nom du projet')
    nom.focus()
    courant = { ...projet, updatedAt: '2026-11-24T13:00:00Z' }
    await act(() => queryClient.invalidateQueries({ queryKey: ['projects', 'p1'] }))
    await waitFor(() => expect(screen.getByLabelText('Nom du projet')).toBeInTheDocument())
    expect(document.activeElement).not.toBe(screen.getByText('Paramètres enregistrés.').closest('[role="status"]'))
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
  })

  it('404 avec la politique de production : une seule requête', async () => {
    let appels = 0
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(me)),
      http.get('/api/projects/:id', () => { appels++; return HttpResponse.json({ message: 'Projet introuvable.' }, { status: 404 }) }),
      http.get('/api/projects/:id/plan', () => HttpResponse.json({ message: 'Projet introuvable.' }, { status: 404 })),
    )
    renderApp('/projets/zzz', {})
    expect(await screen.findByText('Projet introuvable.')).toBeInTheDocument()
    expect(appels).toBe(1)
  })

  it('500 avec la politique de production : réessayé', async () => {
    let appels = 0
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(me)),
      http.get('/api/projects/:id', () => { appels++; return HttpResponse.json({ message: 'Boum.' }, { status: 500 }) }),
      http.get('/api/projects/:id/plan', () => HttpResponse.json({ message: 'Boum.' }, { status: 500 })),
    )
    renderApp('/projets/zzz', { retryDelay: 0 })
    expect(await screen.findByText('Boum.')).toBeInTheDocument()
    expect(appels).toBe(3)
  })

  it('échec d\'une actualisation : la page reste, avertissement non bloquant', async () => {
    mockProjet([])
    const { queryClient } = renderApp('/projets/p1')
    expect(await screen.findByRole('heading', { name: 'Alpha' })).toBeInTheDocument()
    server.use(http.get('/api/projects/:id', () => HttpResponse.json({ message: 'Boum.' }, { status: 500 })))
    await queryClient.invalidateQueries({ queryKey: ['projects', 'p1'], exact: true })
    expect(await screen.findByText("Impossible d'actualiser le projet.")).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByLabelText('Largeur (m)')).toBeInTheDocument()
  })

  it('axe', async () => {
    mockProjet([v('error', 'Erreur B')])
    const { container } = renderApp('/projets/p1')
    await screen.findByText('Erreur B')
    await screen.findByLabelText('Largeur (m)')
    expect(await axe(container)).toHaveNoViolations()
  })
})
