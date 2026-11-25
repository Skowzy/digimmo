import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RULE_PARAMS, parsePlan, rectangularSite, validatePlan, type Plan } from '@digimmo/domain'
import { server } from '../../test/server'
import { renderApp } from '../../test/render'

const me = { id: 'u1', email: 'a@b.fr', role: 'user' }
const site = rectangularSite(3000, 4000, 'south')
const projet = {
  id: 'p1', name: 'Maison', site, rules: DEFAULT_RULE_PARAMS,
  createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z',
}
const vide: Plan = { levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }], stairs: null }
const validation = { violations: [], checkedAt: 'x' }
const catalogue = [
  { id: 'lit2', category: 'chambre', name: 'Lit double', widthCm: 160, depthCm: 200, symbol: 'bed' },
]

const svg = () => screen.getByRole('img', { name: 'Plan du projet' })
const pt = (x: number, y: number) => ({ pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y })
const glisser = (a: [number, number], b: [number, number]) => {
  fireEvent.pointerDown(svg(), pt(...a))
  fireEvent.pointerMove(svg(), pt(...b))
  fireEvent.pointerUp(svg(), pt(...b))
}
const cliquer = (x: number, y: number) => {
  fireEvent.pointerDown(svg(), pt(x, y))
  fireEvent.pointerUp(svg(), pt(x, y))
}
const outil = (nom: string) => userEvent.click(screen.getByRole('button', { name: nom }))
const nommer = async (nom: string, type: string) => {
  const champ = screen.getByLabelText('Nom')
  await userEvent.clear(champ)
  await userEvent.type(champ, `${nom}{Enter}`)
  await userEvent.selectOptions(screen.getByLabelText('Type'), type)
}
const dessiner = async (a: [number, number], b: [number, number], nom: string, type: string) => {
  await outil('Pièce (P)')
  glisser(a, b)
  await nommer(nom, type)
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => { vi.useRealTimers() })

describe('parcours complet de l\'éditeur', () => {
  it('maison à deux niveaux dessinée à la souris : aucune erreur, sauvegarde automatique valide', async () => {
    const puts: unknown[] = []
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(me)),
      http.get('/api/projects', () => HttpResponse.json([])),
      http.get('/api/projects/:id', () => HttpResponse.json(projet)),
      http.get('/api/catalog', () => HttpResponse.json(catalogue)),
      http.get('/api/projects/:id/plan', () => HttpResponse.json({ plan: vide, validation })),
      http.put('/api/projects/:id/plan', async ({ request }) => {
        puts.push(await request.json())
        return HttpResponse.json({ validation })
      }),
    )
    renderApp('/projets/p1')
    await screen.findByRole('img', { name: 'Plan du projet' })

    // Trois pièces collées : séjour, cuisine à sa droite, chambre en dessous.
    await dessiner([500, 500], [1100, 1000], 'Séjour', 'sejour')
    await dessiner([1100, 500], [1500, 1000], 'Cuisine', 'cuisine')
    await dessiner([500, 1000], [1100, 1400], 'Chambre', 'chambre')

    // Porte sur le mur séjour / chambre.
    await outil('Porte (D)')
    cliquer(800, 1000)
    expect(screen.getByRole('heading', { name: 'Porte' })).toBeInTheDocument()

    // Lit dans la chambre.
    await outil('Meuble (M)')
    await userEvent.click(await screen.findByRole('button', { name: /Lit double/ }))
    cliquer(800, 1250)
    expect(screen.getByRole('heading', { name: 'Meuble : Lit double' })).toBeInTheDocument()

    // Étage : chambre au-dessus du séjour, escalier dans le séjour sur les deux niveaux.
    await userEvent.click(screen.getByRole('button', { name: '+ Étage' }))
    expect(screen.getByRole('tab', { name: 'Étage' })).toHaveAttribute('aria-selected', 'true')
    await dessiner([500, 500], [1100, 1000], 'Chambre 2', 'chambre')
    await outil('Escalier (E)')
    glisser([600, 600], [700, 900])
    expect(screen.getByRole('heading', { name: 'Propriétés' })).toBeInTheDocument()

    // Aucune erreur dans le panneau des règles.
    expect(screen.getByRole('heading', { name: 'Règles' })).toBeInTheDocument()
    expect(screen.getByText('Aucun problème détecté')).toBeInTheDocument()

    // Sauvegarde automatique après 3 s.
    expect(puts).toHaveLength(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(3200) })
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
    expect(puts).toHaveLength(1)

    const corps = puts[0]
    const analyse = parsePlan(corps)
    expect(analyse.ok).toBe(true)
    if (!analyse.ok) return
    const plan = analyse.plan
    expect(plan.levels.map((l) => [l.id, l.rooms.length, l.openings.length, l.furniture.length]))
      .toEqual([['rdc', 3, 1, 1], ['r1', 1, 0, 0]])
    expect(plan.stairs).not.toBeNull()
    expect(validatePlan(site, DEFAULT_RULE_PARAMS, plan).filter((v) => v.severity === 'error')).toEqual([])
  })
})
