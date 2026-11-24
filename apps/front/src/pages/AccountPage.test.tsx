import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { renderApp } from '../test/render'

const me = { id: 'u1', email: 'a@b.fr', role: 'user' }

function mock() {
  server.use(http.get('/api/auth/me', () => HttpResponse.json(me)))
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
})

describe('mon compte', () => {
  it('affiche l\'e-mail et le rôle', async () => {
    mock()
    renderApp('/compte')
    expect(await screen.findByRole('heading', { level: 1, name: 'Mon compte' })).toBeInTheDocument()
    expect(await screen.findByText('Utilisateur')).toBeInTheDocument()
    expect(screen.getAllByText('a@b.fr').length).toBeGreaterThan(0)
  })

  it('administrateur', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ ...me, role: 'admin' })))
    renderApp('/compte')
    expect(await screen.findByText('Administrateur')).toBeInTheDocument()
  })

  it('export : requête, Blob JSON, téléchargement puis URL révoquée', async () => {
    mock()
    const data = { exportedAt: '2026-11-24T10:00:00Z', user: { id: 'u1' }, projects: [] }
    server.use(http.get('/api/me/export', () => HttpResponse.json(data)))
    const create = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const clics: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clics.push(this.download)
    })
    renderApp('/compte')
    await userEvent.click(await screen.findByRole('button', { name: 'Exporter mes données' }))
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:x'))
    const blob = (create.mock.calls[0] as unknown as [Blob])[0]
    expect(blob.type).toBe('application/json')
    expect(JSON.parse(await blob.text())).toEqual(data)
    expect(clics).toEqual(['digimmo-export.json'])
  })

  it('export en erreur : alerte', async () => {
    mock()
    server.use(http.get('/api/me/export', () => HttpResponse.json({ message: 'Boum.' }, { status: 500 })))
    renderApp('/compte')
    await userEvent.click(await screen.findByRole('button', { name: 'Exporter mes données' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Boum.')
  })

  it('suppression : mot de passe vide => erreur locale, aucune requête', async () => {
    mock()
    let appels = 0
    server.use(http.delete('/api/me', () => { appels++; return new HttpResponse(null, { status: 204 }) }))
    renderApp('/compte')
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    const dialogue = screen.getByRole('dialog')
    expect(dialogue).toHaveTextContent('Vos projets et vos plans seront définitivement supprimés.')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Supprimer définitivement' }))
    expect(within(dialogue).getByText('Saisissez votre mot de passe.')).toBeInTheDocument()
    expect(appels).toBe(0)
  })

  it('suppression : mauvais mot de passe => message dans la modale, compte toujours affiché', async () => {
    mock()
    server.use(http.delete('/api/me', () => HttpResponse.json({ message: 'Mot de passe incorrect.' }, { status: 403 })))
    renderApp('/compte')
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    const dialogue = screen.getByRole('dialog')
    expect(within(dialogue).getByLabelText('Mot de passe')).toHaveAttribute('autocomplete', 'current-password')
    await userEvent.type(within(dialogue).getByLabelText('Mot de passe'), 'mauvais')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Supprimer définitivement' }))
    expect(await within(dialogue).findByRole('alert')).toHaveTextContent('Mot de passe incorrect.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Mon compte' })).toBeInTheDocument()
  })

  it('suppression : trop de tentatives (429) => message dans la modale', async () => {
    mock()
    server.use(http.delete('/api/me', () => HttpResponse.json({ message: 'Trop de tentatives. Réessayez dans une minute.' }, { status: 429 })))
    renderApp('/compte')
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    const dialogue = screen.getByRole('dialog')
    await userEvent.type(within(dialogue).getByLabelText('Mot de passe'), 'x')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Supprimer définitivement' }))
    expect(await within(dialogue).findByRole('alert')).toHaveTextContent('Trop de tentatives.')
  })

  it('suppression : bon mot de passe => DELETE { password } puis accueil avec message', async () => {
    mock()
    const corps: unknown[] = []
    server.use(http.delete('/api/me', async ({ request }) => {
      corps.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }))
    const { router } = renderApp('/compte')
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Mot de passe'), 'secret123')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer définitivement' }))
    expect(await screen.findByText('Votre compte a été supprimé.')).toBeInTheDocument()
    expect(corps).toEqual([{ password: 'secret123' }])
    expect(router.state.location.pathname).toBe('/')
  })

  it('axe sans violation, y compris modale ouverte', async () => {
    mock()
    const { container } = renderApp('/compte')
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
