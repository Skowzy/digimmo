import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RULE_PARAMS, rectangularSite, type Plan } from '@digimmo/domain'
import { server } from '../../../test/server'
import { renderApp } from '../../../test/render'

const me = { id: 'u1', email: 'a@b.fr', role: 'user' }
const projet = {
  id: 'p1', name: 'Alpha', site: rectangularSite(2000, 3000, 'south'), rules: DEFAULT_RULE_PARAMS,
  createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z',
}
const vide: Plan = { levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }], stairs: null }
const validation = { violations: [], checkedAt: 'x' }

/** Serveur simulé : GET renvoie le dernier plan reçu ; `reponses` pilote les PUT successifs. */
function serveur(initial: Plan, reponses: (n: number, plan: Plan) => Response | Promise<Response> = () => HttpResponse.json({ validation })) {
  const s = { stocke: initial, puts: [] as Plan[] }
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(me)),
    http.get('/api/projects', () => HttpResponse.json([])),
    http.get('/api/projects/:id', () => HttpResponse.json(projet)),
    http.get('/api/projects/:id/plan', () => HttpResponse.json({ plan: s.stocke, validation })),
    http.put('/api/projects/:id/plan', async ({ request }) => {
      const plan = (await request.json()) as Plan
      s.puts.push(plan)
      const r = await reponses(s.puts.length, plan)
      if (r.ok) s.stocke = plan
      return r
    }),
  )
  return s
}
const avecSalon: Plan = {
  levels: [{ id: 'rdc', rooms: [{ id: 's1', type: 'sejour', name: 'Salon', rect: { x: 500, y: 500, w: 600, h: 400 } }], openings: [], furniture: [] }],
  stairs: null,
}
const selectionnerSalon = async (container: HTMLElement) => {
  const piece = container.querySelector('[data-room="s1"]') as Element
  await userEvent.pointer([{ keys: '[MouseLeft>]', target: piece }, { keys: '[/MouseLeft]', target: piece }])
}
const avancer = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const modifier = () => userEvent.click(screen.getByRole('button', { name: '+ Étage' }))
const ouvrir = async () => {
  const r = renderApp('/projets/p1')
  await screen.findByRole('img', { name: 'Plan du projet' })
  return r
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => { vi.useRealTimers() })

describe('sauvegarde automatique', () => {
  it('modification : « Modifications non enregistrées », puis après 3 s un PUT et « Enregistré »', async () => {
    const s = serveur(vide)
    await ouvrir()
    expect(screen.getByText('Enregistré')).toBeInTheDocument()
    await modifier()
    expect(screen.getByText('Modifications non enregistrées')).toBeInTheDocument()
    await avancer(2900)
    expect(s.puts).toHaveLength(0)
    await avancer(200)
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    expect(s.puts).toHaveLength(1)
    expect(s.puts[0]!.levels.map((l) => l.id)).toEqual(['rdc', 'r1'])
  })

  it('le délai repart à chaque modification : deux vraies modifications à 1 s d\'écart, un seul PUT 3 s après la seconde', async () => {
    const s = serveur(avecSalon)
    const { container } = await ouvrir()
    await selectionnerSalon(container)
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'chambre')
    expect(screen.getByText('Modifications non enregistrées')).toBeInTheDocument()
    await avancer(1000)
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'cuisine')
    await avancer(2500)
    expect(s.puts).toHaveLength(0)
    await avancer(1000)
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    expect(s.puts).toHaveLength(1)
    expect(s.puts[0]!.levels[0]!.rooms[0]!.type).toBe('cuisine')
  })

  it('modification pendant un envoi : second PUT avec la dernière version, jamais deux en vol', async () => {
    let enVol = 0, max = 0
    let liberer: () => void = () => {}
    const s = serveur(vide, async (n) => {
      enVol++; max = Math.max(max, enVol)
      if (n === 1) await new Promise<void>((r) => { liberer = r })
      enVol--
      return HttpResponse.json({ validation })
    })
    await ouvrir()
    await modifier()
    await avancer(3100)
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(screen.getByText('Enregistrement…')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retirer l\'étage' }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Retirer l\'étage' }).at(-1)!)
    await avancer(4000)
    expect(s.puts).toHaveLength(1)
    liberer()
    await avancer(3500)
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    expect(s.puts).toHaveLength(2)
    expect(s.puts[1]!.levels.map((l) => l.id)).toEqual(['rdc'])
    expect(max).toBe(1)
  })

  it('undo après une sauvegarde automatique : « Modifications non enregistrées » puis nouveau PUT', async () => {
    const s = serveur(vide)
    await ouvrir()
    await modifier()
    await avancer(3100)
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByText('Modifications non enregistrées')).toBeInTheDocument()
    await avancer(3100)
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    expect(s.puts).toHaveLength(2)
    expect(s.puts[1]).toEqual(vide)
  })

  it('« Enregistrer » sauvegarde tout de suite', async () => {
    const s = serveur(vide)
    await ouvrir()
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    await modifier()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    expect(s.puts).toHaveLength(1)
    await avancer(5000)
    expect(s.puts).toHaveLength(1)
  })

  it('met à jour le cache du plan avec la validation renvoyée', async () => {
    const v = { violations: [{ code: 'ROOM_MIN_AREA', severity: 'error', message: 'm', refs: [] }], checkedAt: 'y' }
    serveur(vide, () => HttpResponse.json({ validation: v }))
    const { queryClient } = await ouvrir()
    await modifier()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    const cache = queryClient.getQueryData<{ plan: Plan; validation: unknown }>(['projects', 'p1', 'plan'])
    expect(cache?.validation).toEqual(v)
    expect(cache?.plan.levels).toHaveLength(2)
  })

  it('400 : « Échec de l\'enregistrement » avec les issues, sans nouvel essai automatique', async () => {
    const s = serveur(vide, () => HttpResponse.json({ message: 'Format de plan invalide.', issues: ['levels: trop court'] }, { status: 400 }))
    await ouvrir()
    await modifier()
    await avancer(3100)
    await waitFor(() => expect(screen.getByText("Échec de l'enregistrement")).toBeInTheDocument())
    expect(screen.getByText('levels: trop court')).toBeInTheDocument()
    await avancer(30000)
    expect(s.puts).toHaveLength(1)
  })

  it('413 et 404 : message affiché, sans nouvel essai', async () => {
    const s = serveur(vide, () => HttpResponse.json({ message: 'Plan trop volumineux (1 Mo maximum).' }, { status: 413 }))
    await ouvrir()
    await modifier()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Plan trop volumineux (1 Mo maximum).')).toBeInTheDocument()
    await avancer(30000)
    expect(s.puts).toHaveLength(1)
  })

  it('404 : « Ce projet n\'existe plus. » sans nouvel essai', async () => {
    const s = serveur(vide, () => HttpResponse.json({ message: 'Projet introuvable.' }, { status: 404 }))
    await ouvrir()
    await modifier()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText("Ce projet n'existe plus.")).toBeInTheDocument()
    await avancer(30000)
    expect(s.puts).toHaveLength(1)
  })

  it('500 : « Échec de l\'enregistrement » puis nouvel essai après 10 s, puis « Enregistré »', async () => {
    const s = serveur(vide, (n) => n === 1 ? HttpResponse.json({ message: 'boum' }, { status: 500 }) : HttpResponse.json({ validation }))
    await ouvrir()
    await modifier()
    await avancer(3100)
    await waitFor(() => expect(screen.getByText("Échec de l'enregistrement")).toBeInTheDocument())
    await avancer(9000)
    expect(s.puts).toHaveLength(1)
    await avancer(1500)
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    expect(s.puts).toHaveLength(2)
  })

  it('« Réessayer » renvoie tout de suite', async () => {
    const s = serveur(vide, (n) => n === 1 ? HttpResponse.json({ message: 'boum' }, { status: 500 }) : HttpResponse.json({ validation }))
    await ouvrir()
    await modifier()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText("Échec de l'enregistrement")
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    expect(s.puts).toHaveLength(2)
  })

  it('aller-retour : plan à deux niveaux (escalier, porte, fenêtre, meuble) enregistré puis rechargé à l\'identique', async () => {
    const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
    const complet: Plan = {
      levels: [
        {
          id: 'rdc',
          rooms: [{ id: 's1', type: 'sejour', name: 'Salon', rect: rect(500, 500, 600, 400) }],
          openings: [
            { id: 'o1', kind: 'door', orientation: 'h', fixed: 500, start: 600, width: 90, swing: { hinge: 'start', side: 'pos' } },
            { id: 'o2', kind: 'window', orientation: 'v', fixed: 1100, start: 600, width: 120 },
          ],
          furniture: [{ id: 'f1', catalogId: 'canape', label: 'Canapé', x: 600, y: 700, w: 200, d: 90, rotation: 90 }],
        },
        { id: 'r1', rooms: [{ id: 'tmp', type: 'chambre', name: 'Temp', rect: rect(500, 500, 300, 300) }], openings: [], furniture: [] },
      ],
      stairs: { rect: rect(900, 600, 100, 250) },
    }
    const attendu: Plan = { ...complet, levels: [complet.levels[0]!, { ...complet.levels[1]!, rooms: [] }] }
    const s = serveur(complet)
    const { router, container, queryClient } = await ouvrir()
    await userEvent.click(screen.getByRole('tab', { name: /étage|R\+1|Étage/i }))
    const piece = container.querySelector('[data-room="tmp"]') as Element
    await userEvent.pointer([{ keys: '[MouseLeft>]', target: piece }, { keys: '[/MouseLeft]', target: piece }])
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer la pièce' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    expect(s.puts).toHaveLength(1)
    expect(s.puts[0]).toEqual(attendu)

    await act(async () => { await router.navigate('/projets') })
    await screen.findByRole('heading', { name: /projets/i })
    queryClient.removeQueries({ queryKey: ['projects', 'p1'] }) // le rechargement vient du serveur
    await act(async () => { await router.navigate('/projets/p1') })
    await screen.findByRole('img', { name: 'Plan du projet' })
    expect(s.stocke).toEqual(attendu)
    expect(screen.getByText('Enregistré')).toBeInTheDocument()
    // Le plan de l'éditeur rechargé est relu via un envoi : une seule modification connue (type du salon).
    await selectionnerSalon(container)
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'chambre')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(s.puts).toHaveLength(2))
    const modifie: Plan = structuredClone(attendu)
    modifie.levels[0]!.rooms[0]!.type = 'chambre'
    expect(s.puts[1]).toEqual(modifie)
  })
})

describe('quitter l\'éditeur', () => {
  it('navigation avec des modifications : modale ; « Rester » garde la page', async () => {
    serveur(vide)
    const { router } = await ouvrir()
    await modifier()
    await act(async () => { await router.navigate('/projets') })
    expect(await screen.findByRole('heading', { name: 'Des modifications ne sont pas enregistrées.' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/projets/p1')
    await userEvent.click(screen.getByRole('button', { name: 'Rester' }))
    expect(screen.queryByRole('heading', { name: 'Des modifications ne sont pas enregistrées.' })).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/projets/p1')
    expect(screen.getByRole('img', { name: 'Plan du projet' })).toBeInTheDocument()
  })

  it('« Quitter sans enregistrer » quitte sans PUT', async () => {
    const s = serveur(vide)
    const { router } = await ouvrir()
    await modifier()
    await act(async () => { await router.navigate('/projets') })
    await userEvent.click(await screen.findByRole('button', { name: 'Quitter sans enregistrer' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projets'))
    expect(s.puts).toHaveLength(0)
  })

  it('« Enregistrer et quitter » sauvegarde puis quitte ; en échec, reste et affiche l\'erreur', async () => {
    const s = serveur(vide, (n) => n === 1 ? HttpResponse.json({ message: 'boum' }, { status: 500 }) : HttpResponse.json({ validation }))
    const { router } = await ouvrir()
    await modifier()
    await act(async () => { await router.navigate('/projets') })
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer et quitter' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    await waitFor(() => expect(screen.getByText("Échec de l'enregistrement")).toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/projets/p1')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer et quitter' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projets'))
    expect(s.puts).toHaveLength(2)
  })

  it('sans modification, on quitte sans modale', async () => {
    serveur(vide)
    const { router } = await ouvrir()
    await act(async () => { await router.navigate('/projets') })
    await waitFor(() => expect(router.state.location.pathname).toBe('/projets'))
  })

  it('beforeunload : bloqué seulement tant que le plan est modifié', async () => {
    serveur(vide)
    await ouvrir()
    const evt = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented }
    expect(evt()).toBe(false)
    await modifier()
    expect(evt()).toBe(true)
  })

  it('session expirée (401 au PUT) : la redirection vers /connexion n\'est pas bloquée', async () => {
    serveur(vide, () => HttpResponse.json({ message: 'Non authentifié.' }, { status: 401 }))
    const { router } = await ouvrir()
    await modifier()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'))
    expect(screen.queryByRole('heading', { name: 'Des modifications ne sont pas enregistrées.' })).not.toBeInTheDocument()
  })
})

describe('cycle de vie et erreurs', () => {
  it('démontage pendant un envoi qui échoue : pas de nouvel essai fantôme, cache inchangé', async () => {
    let liberer: () => void = () => {}
    const s = serveur(vide, async () => {
      await new Promise<void>((r) => { liberer = r })
      return HttpResponse.json({ message: 'boum' }, { status: 500 })
    })
    const { router, queryClient } = await ouvrir()
    await modifier()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    await act(async () => { await router.navigate('/projets') })
    await userEvent.click(await screen.findByRole('button', { name: 'Quitter sans enregistrer' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projets'))
    liberer()
    await avancer(30000)
    expect(s.puts).toHaveLength(1)
    expect(queryClient.getQueryData<{ plan: Plan }>(['projects', 'p1', 'plan'])?.plan).toEqual(vide)
  })

  it('démontage pendant un envoi qui réussit : le cache reçoit le plan envoyé, la réouverture le montre', async () => {
    let liberer: () => void = () => {}
    const s = serveur(vide, async () => {
      await new Promise<void>((r) => { liberer = r })
      return HttpResponse.json({ validation })
    })
    const { router, queryClient } = await ouvrir()
    await modifier()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    await act(async () => { await router.navigate('/projets') })
    await userEvent.click(await screen.findByRole('button', { name: 'Quitter sans enregistrer' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projets'))
    liberer()
    await waitFor(() => expect(queryClient.getQueryData<{ plan: Plan }>(['projects', 'p1', 'plan'])?.plan.levels).toHaveLength(2))
    await act(async () => { await router.navigate('/projets/p1') })
    await screen.findByRole('img', { name: 'Plan du projet' })
    expect(screen.getByRole('tablist', { name: 'Niveaux' })).toBeInTheDocument()
    expect(screen.getByText('Enregistré')).toBeInTheDocument()
  })

  it('après un échec, revenir au plan enregistré (undo) efface l\'erreur', async () => {
    serveur(vide, () => HttpResponse.json({ message: 'Format de plan invalide.', issues: ['x: y'] }, { status: 400 }))
    await ouvrir()
    await modifier()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText("Échec de l'enregistrement")
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    expect(screen.queryByText("Échec de l'enregistrement")).not.toBeInTheDocument()
  })
})
