import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RULE_PARAMS, rectangularSite, validatePlan, type Furniture, type Plan, type Room } from '@digimmo/domain'
import { createQueryClient } from '../../../app/queryClient'
import { useCatalog } from '../../../lib/queries'
import { server } from '../../../test/server'
import { PlanCanvas } from '../canvas/PlanCanvas'
import { EditorProvider } from '../state/EditorContext'
import { currentLevel, initEditor } from '../state/reducer'
import type { EditorState, Tool } from '../state/types'
import { useEditor } from '../state/useEditor'
import { CatalogPalette } from './CatalogPalette'
import { PropertiesPanel } from './PropertiesPanel'

const site = rectangularSite(2000, 3000, 'south')
const catalogue = [
  { id: 'lit2', category: 'chambre', name: 'Lit double', widthCm: 140, depthCm: 190, symbol: 'bed' },
  { id: 'evier', category: 'cuisine', name: 'Évier', widthCm: 120, depthCm: 60, symbol: 'sink' },
  { id: 'table', category: 'sejour', name: 'Table', widthCm: 160, depthCm: 200, symbol: 'table' },
]
const grande: Room = { id: 'g', type: 'sejour', name: 'Grande', rect: { x: 0, y: 0, w: 1000, h: 1000 } }
const planDe = (rooms: Room[], furniture: Furniture[] = []): Plan => ({ levels: [{ id: 'rdc', rooms, openings: [], furniture }], stairs: null })

const h = {} as { etat: EditorState }
function Sonde() {
  const e = useEditor()
  useEffect(() => { h.etat = e.state })
  return null
}
function Plateau() {
  const { data } = useCatalog()
  return <PlanCanvas site={site} rules={DEFAULT_RULE_PARAMS} violations={[]} catalogue={data} />
}
function monter(plan: Plan, tool: Tool = 'furniture', selection: EditorState['selection'] = null, pending: string | null = null) {
  server.use(http.get('/api/catalog', () => HttpResponse.json(catalogue)))
  const client = createQueryClient({ retry: false })
  render(
    <QueryClientProvider client={client}>
      <EditorProvider initial={{ ...initEditor(plan, site), tool, selection, pendingFurniture: pending }}>
        <CatalogPalette />
        <Plateau />
        <PropertiesPanel />
        <Sonde />
      </EditorProvider>
    </QueryClientProvider>,
  )
  return client
}
const svg = () => screen.getByRole('img', { name: 'Plan du projet' })
const pt = (x: number, y: number) => ({ pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y })
const cliquer = (x: number, y: number) => { fireEvent.pointerDown(svg(), pt(x, y)); fireEvent.pointerUp(svg(), pt(x, y)) }
const meubles = () => currentLevel(h.etat).furniture
const lit = () => screen.findByRole('button', { name: /Lit double/ })

describe('palette du catalogue', () => {
  it('groupe par catégorie, avec nom et dimensions', async () => {
    monter(planDe([grande]))
    expect(await lit()).toHaveAccessibleName('Lit double 1,40 × 1,90 m')
    expect(screen.getByRole('heading', { name: 'Chambre' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cuisine' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Séjour' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Salle de bain' })).toBeNull()
  })
  it('absente quand l\'outil Meuble n\'est pas actif', () => {
    monter(planDe([grande]), 'select')
    expect(screen.queryByRole('heading', { name: 'Meubles' })).toBeNull()
  })
  it('choisir un meuble l\'arme (aria-pressed)', async () => {
    monter(planDe([grande]))
    await userEvent.click(await lit())
    expect(h.etat.pendingFurniture).toBe('lit2')
    expect(screen.getByRole('button', { name: /Lit double/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Évier/ })).toHaveAttribute('aria-pressed', 'false')
  })
  it('Échap désarme', async () => {
    monter(planDe([grande]), 'furniture', null, 'lit2')
    await userEvent.click(await lit())
    await userEvent.keyboard('{Escape}')
    expect(h.etat.pendingFurniture).toBeNull()
  })
  it('Échap sur le plan désarme', async () => {
    monter(planDe([grande]), 'furniture', null, 'lit2')
    await lit()
    fireEvent.keyDown(svg(), { key: 'Escape' })
    expect(h.etat.pendingFurniture).toBeNull()
  })
  it('désarme si le catalogue ne contient plus le meuble armé', async () => {
    const client = monter(planDe([grande]), 'furniture', null, 'lit2')
    await lit()
    expect(h.etat.pendingFurniture).toBe('lit2')
    server.use(http.get('/api/catalog', () => HttpResponse.json(catalogue.filter((c) => c.id !== 'lit2'))))
    await act(() => client.invalidateQueries({ queryKey: ['catalog'] }))
    await waitFor(() => expect(h.etat.pendingFurniture).toBeNull())
  })
  it('catalogue en erreur : message + Réessayer, le plan fonctionne', async () => {
    server.use(http.get('/api/catalog', () => HttpResponse.json({ error: 'x' }, { status: 500 })))
    render(
      <QueryClientProvider client={createQueryClient({ retry: false })}>
        <EditorProvider initial={{ ...initEditor(planDe([grande]), site), tool: 'furniture' }}>
          <CatalogPalette />
          <Plateau />
          <Sonde />
        </EditorProvider>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Catalogue indisponible.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    cliquer(300, 300)
    expect(meubles()).toHaveLength(0)
    expect(svg()).toBeInTheDocument()
    server.use(http.get('/api/catalog', () => HttpResponse.json(catalogue)))
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await lit()).toBeInTheDocument()
  })
})

describe('pose sur le plan', () => {
  it('Lit double cliqué en (300, 300) : centré, aimanté, label du catalogue', async () => {
    monter(planDe([grande]))
    await userEvent.click(await lit())
    cliquer(300, 300)
    expect(meubles()).toHaveLength(1)
    expect(meubles()[0]).toMatchObject({ x: 230, y: 210, w: 140, d: 190, rotation: 0, label: 'Lit double', catalogId: 'lit2' })
    expect(h.etat.selection).toEqual({ kind: 'furniture', id: meubles()[0]!.id })
    expect(h.etat.past).toHaveLength(1)
  })
  it('reste armé : plusieurs poses', async () => {
    monter(planDe([grande]))
    await userEvent.click(await lit())
    cliquer(300, 300)
    cliquer(700, 700)
    expect(meubles()).toHaveLength(2)
    expect(h.etat.pendingFurniture).toBe('lit2')
    expect(new Set(meubles().map((m) => m.id)).size).toBe(2)
  })
  it('sans meuble armé : rien', async () => {
    monter(planDe([grande]))
    await lit()
    cliquer(300, 300)
    expect(meubles()).toHaveLength(0)
    expect(h.etat.past).toHaveLength(0)
  })
  it('s\'aimante au mur de la pièce', async () => {
    monter(planDe([grande]))
    await userEvent.click(await lit())
    cliquer(72, 500) // bord gauche brut à 2 cm, mur à 0 : seuil nul en jsdom => grille (0)
    expect(meubles()[0]!.x).toBe(0)
  })
  it('s\'aimante aux autres meubles (bord exact)', async () => {
    const autre: Furniture = { id: 'f0', catalogId: 'table', label: 'Table', x: 100, y: 100, w: 160, d: 200, rotation: 0 }
    monter(planDe([grande], [autre]))
    await userEvent.click(await lit())
    cliquer(330, 200) // bord gauche brut 260 = bord droit de la table
    expect(meubles()[1]).toMatchObject({ x: 260 })
  })
  it('meuble à cheval sur deux pièces : violation', async () => {
    const a: Room = { id: 'a', type: 'sejour', name: 'A', rect: { x: 0, y: 0, w: 300, h: 500 } }
    const b: Room = { id: 'b', type: 'chambre', name: 'B', rect: { x: 300, y: 0, w: 300, h: 500 } }
    monter(planDe([a, b]))
    await userEvent.click(await lit())
    cliquer(300, 300)
    const v = validatePlan(site, DEFAULT_RULE_PARAMS, h.etat.plan)
    expect(v.map((x) => x.message)).toContain('« Lit double » doit être entièrement dans une pièce.')
  })
  it('501e meuble refusé avec message', async () => {
    const pleins: Furniture[] = Array.from({ length: 500 }, (_, i) => ({ id: `f${i}`, catalogId: 'table', label: 'T', x: 0, y: 0, w: 10, d: 10, rotation: 0 }))
    monter(planDe([grande], pleins))
    await userEvent.click(await lit())
    cliquer(300, 300)
    expect(meubles()).toHaveLength(500)
    expect(await screen.findByText('Limite de 500 meubles par niveau atteinte.')).toBeInTheDocument()
  })
})

describe('meuble existant', () => {
  const f: Furniture = { id: 'f1', catalogId: 'lit2', label: 'Lit double', x: 230, y: 210, w: 140, d: 190, rotation: 0 }
  it('R sur le plan tourne le meuble sélectionné', () => {
    monter(planDe([grande], [f]), 'select', { kind: 'furniture', id: 'f1' })
    fireEvent.keyDown(svg(), { key: 'r' })
    expect(meubles()[0]).toMatchObject({ rotation: 90 })
    const fp = document.querySelector('[data-furniture="f1"] rect')!
    expect(fp.getAttribute('width')).toBe('190')
    expect(fp.getAttribute('height')).toBe('140')
  })
  it('R sans meuble sélectionné : rien', () => {
    monter(planDe([grande], [f]), 'select')
    fireEvent.keyDown(svg(), { key: 'r' })
    expect(meubles()[0]!.rotation).toBe(0)
  })
  it('sélection par clic et déplacement aimanté', () => {
    monter(planDe([grande], [f]), 'select')
    const el = document.querySelector('[data-furniture="f1"]')!
    fireEvent.pointerDown(el, pt(300, 300))
    expect(h.etat.selection).toEqual({ kind: 'furniture', id: 'f1' })
    fireEvent.pointerMove(svg(), pt(404, 303))
    fireEvent.pointerUp(svg(), pt(404, 303))
    expect(meubles()[0]).toMatchObject({ x: 330, y: 210, w: 140, d: 190 })
    expect(h.etat.past).toHaveLength(1)
  })
  it('petit mouvement (< 4 px) : sélection sans déplacement', () => {
    monter(planDe([grande], [f]), 'select')
    const el = document.querySelector('[data-furniture="f1"]')!
    fireEvent.pointerDown(el, pt(300, 300))
    fireEvent.pointerMove(svg(), pt(302, 301))
    fireEvent.pointerUp(svg(), pt(302, 301))
    expect(meubles()[0]).toMatchObject({ x: 230, y: 210 })
    expect(h.etat.past).toHaveLength(0)
  })
  it('meuble en erreur : hachure', () => {
    server.use(http.get('/api/catalog', () => HttpResponse.json(catalogue)))
    render(
      <QueryClientProvider client={createQueryClient({ retry: false })}>
        <EditorProvider initial={initEditor(planDe([grande], [f]), site)}>
          <PlanCanvas site={site} rules={DEFAULT_RULE_PARAMS} violations={[{ code: 'FURNITURE_OUTSIDE_ROOM', severity: 'error', message: 'x', refs: ['f1'], level: 'rdc' }]} />
        </EditorProvider>
      </QueryClientProvider>,
    )
    expect(document.querySelector('[data-furniture="f1"] [data-hachure]')).not.toBeNull()
    expect(document.querySelector('[data-furniture="f1"] title')!.textContent).toBe('Lit double')
  })
})

describe('propriétés du meuble', () => {
  const f: Furniture = { id: 'f1', catalogId: 'lit2', label: 'Lit double', x: 230, y: 210, w: 140, d: 190, rotation: 90 }
  it('champs, rotation en lecture seule, rotation et suppression', async () => {
    monter(planDe([grande], [f]), 'select', { kind: 'furniture', id: 'f1' })
    expect(screen.getByLabelText('Libellé')).toHaveValue('Lit double')
    expect(screen.getByLabelText('X (m)')).toHaveValue('2,30')
    expect(screen.getByLabelText('Y (m)')).toHaveValue('2,10')
    expect(screen.getByLabelText('Largeur (m)')).toHaveValue('1,40')
    expect(screen.getByLabelText('Profondeur (m)')).toHaveValue('1,90')
    expect(screen.getByText('90°')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tourner d\'un quart de tour' }))
    expect(meubles()[0]!.rotation).toBe(180)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le meuble' }))
    expect(meubles()).toHaveLength(0)
  })
  it('libellé de 61 caractères refusé ; largeur 0,05 refusée ; largeur 2 valide', async () => {
    monter(planDe([grande], [f]), 'select', { kind: 'furniture', id: 'f1' })
    const l = screen.getByLabelText('Libellé')
    await userEvent.clear(l)
    await userEvent.click(l)
    await userEvent.paste('x'.repeat(61))
    await userEvent.tab()
    expect(meubles()[0]!.label).toBe('Lit double')
    const w = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(w)
    await userEvent.type(w, '0,05')
    await userEvent.tab()
    expect(meubles()[0]!.w).toBe(140)
    await userEvent.clear(w)
    await userEvent.type(w, '2')
    await userEvent.tab()
    await waitFor(() => expect(meubles()[0]!.w).toBe(200))
  })
  it('largeur bornée par la position : x = 99 900, largeur 10,00 m refusée', async () => {
    const g: Furniture = { ...f, x: 99_900, y: 0, rotation: 0 }
    monter(planDe([], [g]), 'select', { kind: 'furniture', id: 'f1' })
    const w = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(w)
    await userEvent.type(w, '10')
    await userEvent.tab()
    expect(meubles()[0]!.w).toBe(140)
    expect(await screen.findByText(/Valeur entre 0,10 m et 1,00 m/)).toBeInTheDocument()
  })
  it('rotation 90 : la largeur est bornée par y', async () => {
    const g: Furniture = { ...f, x: 0, y: 99_900, rotation: 90 }
    monter(planDe([], [g]), 'select', { kind: 'furniture', id: 'f1' })
    const w = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(w)
    await userEvent.type(w, '2')
    await userEvent.tab()
    expect(meubles()[0]!.w).toBe(140)
  })
})
