import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderApp } from '../test/render'

const admin = { id: 'u1', email: 'a@b.fr', role: 'admin' }
type Item = { id: string; category: string; name: string; widthCm: number; depthCm: number; symbol: string }
const items: Item[] = [
  { id: 'f1', category: 'chambre', name: 'Lit double', widthCm: 160, depthCm: 200, symbol: 'bed' },
  { id: 'f2', category: 'chambre', name: 'Armoire', widthCm: 120, depthCm: 60, symbol: 'wardrobe' },
  { id: 'f3', category: 'cuisine', name: 'Table', widthCm: 140, depthCm: 80, symbol: 'table' },
]

function mockCatalog(role = 'admin') {
  const state = [...items]
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json({ ...admin, role })),
    http.get('/api/catalog', () => HttpResponse.json(state)),
  )
  return state
}

describe('administration du catalogue', () => {
  it('tableau groupé par catégorie, dimensions en mètres', async () => {
    mockCatalog()
    renderApp('/admin/catalogue')
    const chambre = await screen.findByRole('table', { name: 'Chambre' })
    expect(within(chambre).getByRole('columnheader', { name: 'Largeur' })).toBeInTheDocument()
    const ligne = within(chambre).getByRole('row', { name: /Lit double/ })
    const largeur = within(ligne).getByText('1,60 m')
    expect(largeur.className).toMatch(/mono/)
    expect(within(ligne).getByText('2,00 m')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Cuisine' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Séjour' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier Lit double' })).toBeInTheDocument()
  })

  it('ajout : POST avec dimensions entières puis ligne visible', async () => {
    const state = mockCatalog()
    let body: unknown
    server.use(http.post('/api/admin/catalog', async ({ request }) => {
      body = await request.json()
      const created = { id: 'f4', ...(body as Omit<Item, 'id'>) }
      state.push(created)
      return HttpResponse.json(created, { status: 201 })
    }))
    renderApp('/admin/catalogue')
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un meuble' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText('Catégorie'), 'sejour')
    await userEvent.type(within(dialog).getByLabelText('Nom'), 'Canapé')
    await userEvent.type(within(dialog).getByLabelText('Largeur (m)'), '2,10')
    await userEvent.type(within(dialog).getByLabelText('Profondeur (m)'), '0,95')
    await userEvent.type(within(dialog).getByLabelText('Pictogramme'), 'sofa')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('row', { name: /Canapé/ })).toBeInTheDocument()
    expect(body).toEqual({ category: 'sejour', name: 'Canapé', widthCm: 210, depthCm: 95, symbol: 'sofa' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('dimensions hors bornes : erreur locale, aucun envoi', async () => {
    mockCatalog()
    let envoye = false
    server.use(http.post('/api/admin/catalog', () => { envoye = true; return HttpResponse.json({}, { status: 201 }) }))
    renderApp('/admin/catalogue')
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un meuble' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Nom'), 'Géant')
    await userEvent.type(within(dialog).getByLabelText('Largeur (m)'), '10,5')
    await userEvent.type(within(dialog).getByLabelText('Profondeur (m)'), '0')
    await userEvent.type(within(dialog).getByLabelText('Pictogramme'), 'x')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    expect(await within(dialog).findByText('La largeur doit être comprise entre 0,01 m et 10,00 m.')).toBeInTheDocument()
    expect(within(dialog).getByText('La profondeur doit être comprise entre 0,01 m et 10,00 m.')).toBeInTheDocument()
    expect(envoye).toBe(false)
  })

  it('modification : PATCH puis valeurs mises à jour', async () => {
    const state = mockCatalog()
    let body: unknown
    server.use(http.patch('/api/admin/catalog/:id', async ({ request }) => {
      body = await request.json()
      state[0] = { ...state[0]!, ...(body as object) }
      return HttpResponse.json(state[0])
    }))
    renderApp('/admin/catalogue')
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier Lit double' }))
    const dialog = await screen.findByRole('dialog')
    const largeur = within(dialog).getByLabelText('Largeur (m)')
    expect(largeur).toHaveValue('1,60')
    await userEvent.clear(largeur)
    await userEvent.type(largeur, '1,80')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('1,80 m')).toBeInTheDocument()
    expect(body).toMatchObject({ widthCm: 180, name: 'Lit double' })
  })

  it('suppression confirmée : DELETE, ligne retirée, focus sur le titre', async () => {
    const state = mockCatalog()
    let supprime = ''
    server.use(http.delete('/api/admin/catalog/:id', ({ params }) => {
      supprime = String(params.id)
      state.splice(state.findIndex((i) => i.id === params.id), 1)
      return new HttpResponse(null, { status: 204 })
    }))
    renderApp('/admin/catalogue')
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer Armoire' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('row', { name: /Armoire/ })).not.toBeInTheDocument())
    expect(supprime).toBe('f2')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
  })

  it('utilisateur non admin : aucun contrôle d\'administration, avant comme après /auth/me', async () => {
    let liberer: () => void = () => undefined
    const porte = new Promise<void>((r) => { liberer = r })
    server.use(
      http.get('/api/auth/me', async () => { await porte; return HttpResponse.json({ ...admin, role: 'user' }) }),
      http.get('/api/catalog', () => HttpResponse.json(items)),
    )
    renderApp('/admin/catalogue')
    expect(screen.queryByRole('button', { name: 'Ajouter un meuble' })).not.toBeInTheDocument()
    liberer()
    expect(await screen.findByText('Accès réservé aux administrateurs.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter un meuble' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Modifier / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Supprimer / })).not.toBeInTheDocument()
  })

  it('axe sans violation', async () => {
    mockCatalog()
    const { container } = renderApp('/admin/catalogue')
    await screen.findByRole('table', { name: 'Chambre' })
    expect((await axe(container)).violations).toEqual([])
  })

  it('focus restitué : Annuler puis enregistrement d\'une modification', async () => {
    const state = mockCatalog()
    server.use(http.patch('/api/admin/catalog/:id', async ({ request }) => {
      state[0] = { ...state[0]!, ...((await request.json()) as object) }
      return HttpResponse.json(state[0])
    }))
    renderApp('/admin/catalogue')
    const ajouter = await screen.findByRole('button', { name: 'Ajouter un meuble' })
    await userEvent.click(ajouter)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(ajouter).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Modifier Lit double' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Modifier Lit double' })).toHaveFocus()
  })

  it('catalogue vide : message et bouton d\'ajout', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(admin)),
      http.get('/api/catalog', () => HttpResponse.json([])),
    )
    renderApp('/admin/catalogue')
    expect(await screen.findByText('Aucun meuble dans le catalogue. Ajoutez-en un.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter un meuble' })).toBeInTheDocument()
  })

  it('double clic : une seule requête DELETE', async () => {
    mockCatalog()
    let n = 0
    server.use(http.delete('/api/admin/catalog/:id', async () => {
      n++
      await new Promise((r) => setTimeout(r, 50))
      return new HttpResponse(null, { status: 204 })
    }))
    renderApp('/admin/catalogue')
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer Armoire' }))
    const bouton = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' })
    act(() => { fireEvent.click(bouton); fireEvent.click(bouton) })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(n).toBe(1)
  })

  it('double clic : une seule requête POST', async () => {
    mockCatalog()
    let n = 0
    server.use(http.post('/api/admin/catalog', async () => {
      n++
      await new Promise((r) => setTimeout(r, 50))
      return HttpResponse.json({ id: 'f9', category: 'chambre', name: 'X', widthCm: 100, depthCm: 100, symbol: 's' }, { status: 201 })
    }))
    renderApp('/admin/catalogue')
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un meuble' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Nom'), 'X')
    await userEvent.type(within(dialog).getByLabelText('Largeur (m)'), '1')
    await userEvent.type(within(dialog).getByLabelText('Profondeur (m)'), '1')
    await userEvent.type(within(dialog).getByLabelText('Pictogramme'), 's')
    const bouton = within(dialog).getByRole('button', { name: 'Enregistrer' })
    act(() => { fireEvent.click(bouton); fireEvent.click(bouton) })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(n).toBe(1)
  })

  it('erreur serveur sur la catégorie liée au select ; axe avec modale ouverte', async () => {
    mockCatalog()
    server.use(http.post('/api/admin/catalog', () =>
      HttpResponse.json({ message: 'Données invalides.', issues: ['category: Catégorie invalide'] }, { status: 400 })))
    const { container } = renderApp('/admin/catalogue')
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un meuble' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Nom'), 'X')
    await userEvent.type(within(dialog).getByLabelText('Largeur (m)'), '1')
    await userEvent.type(within(dialog).getByLabelText('Profondeur (m)'), '1')
    await userEvent.type(within(dialog).getByLabelText('Pictogramme'), 's')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    const select = await within(dialog).findByLabelText('Catégorie')
    await waitFor(() => expect(select).toHaveAttribute('aria-invalid', 'true'))
    expect(select).toHaveAccessibleDescription('Catégorie invalide')
    expect((await axe(container)).violations).toEqual([])
  })
})
