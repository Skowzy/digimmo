import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { api, ApiError, setUnauthorizedHandler } from './api'

afterEach(() => setUnauthorizedHandler(null))

describe('api', () => {
  it('renvoie les données JSON', async () => {
    server.use(http.get('/api/projects', () => HttpResponse.json([{ id: '1' }])))
    await expect(api('/projects')).resolves.toEqual([{ id: '1' }])
  })

  it('renvoie undefined sur 204', async () => {
    server.use(http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })))
    await expect(api('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('envoie le corps en JSON', async () => {
    let recu: unknown
    server.use(
      http.post('/api/projects', async ({ request }) => {
        recu = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )
    await api('/projects', { method: 'POST', body: { name: 'A' } })
    expect(recu).toEqual({ name: 'A' })
  })

  it('lève ApiError avec le message du serveur', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ message: 'Un compte existe déjà avec cette adresse.' }, { status: 409 }),
      ),
    )
    const erreur = await api('/auth/register', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ApiError)
    expect((erreur as ApiError).message).toBe('Un compte existe déjà avec cette adresse.')
    expect((erreur as ApiError).status).toBe(409)
  })

  it('conserve les issues', async () => {
    server.use(
      http.post('/api/projects', () =>
        HttpResponse.json({ message: 'Données invalides.', issues: ['Nom requis.'] }, { status: 400 }),
      ),
    )
    const erreur = (await api('/projects', { method: 'POST', body: {} }).catch((e: unknown) => e)) as ApiError
    expect(erreur.issues).toEqual(['Nom requis.'])
  })

  it('message réseau en français si fetch échoue', async () => {
    server.use(http.get('/api/projects', () => HttpResponse.error()))
    await expect(api('/projects')).rejects.toMatchObject({
      message: 'Erreur réseau. Vérifiez votre connexion.',
    })
  })

  it('« Erreur inattendue. » si le corps n’est pas du JSON', async () => {
    server.use(http.get('/api/projects', () => new HttpResponse('<html>', { status: 500 })))
    await expect(api('/projects')).rejects.toMatchObject({ message: 'Erreur inattendue.', status: 500 })
  })

  it('appelle onUnauthorized une fois sur 401 hors routes d’authentification', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    server.use(http.get('/api/projects', () => HttpResponse.json({ message: 'Non authentifié.' }, { status: 401 })))
    await expect(api('/projects')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['GET', '/auth/me'],
    ['POST', '/auth/login'],
    ['POST', '/auth/register'],
  ])('n’appelle pas onUnauthorized sur 401 de %s %s', async (method, path) => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    server.use(
      http.all(`/api${path}`, () => HttpResponse.json({ message: 'Non authentifié.' }, { status: 401 })),
    )
    await expect(api(path, { method })).rejects.toBeInstanceOf(ApiError)
    expect(handler).not.toHaveBeenCalled()
  })
})
