import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RULE_PARAMS, rectangularSite, type Plan } from '@digimmo/domain'
import { server } from '../../test/server'
import { renderApp } from '../../test/render'
import { EditorProvider } from './state/EditorContext'
import { currentLevel, initEditor } from './state/reducer'
import type { EditorState, Selection } from './state/types'
import { useEditor } from './state/useEditor'
import { useShortcuts } from './useShortcuts'

const site = rectangularSite(2000, 3000, 'south')
const plan: Plan = {
  levels: [{
    id: 'rdc',
    rooms: [{ id: 's1', type: 'sejour', name: 'Salon', rect: { x: 500, y: 500, w: 400, h: 200 } }],
    openings: [{ id: 'o1', kind: 'window', orientation: 'h', fixed: 500, start: 600, width: 100 }],
    furniture: [{ id: 'f1', catalogId: 'c', label: 'Canapé', x: 600, y: 550, w: 100, d: 50, rotation: 0 }],
  }],
  stairs: null,
}
const avecEtage: Plan = { ...plan, levels: [...plan.levels, { id: 'r1', rooms: [], openings: [], furniture: [] }] }

const h = {} as { etat: EditorState }
function Sonde({ saveNow, openHelp }: { saveNow: () => Promise<boolean>; openHelp: () => void }) {
  const { state, dispatch } = useEditor()
  useEffect(() => { h.etat = state })
  useShortcuts(dispatch, state, { saveNow, openHelp })
  return <input aria-label="champ" />
}
function monter(selection: Selection = { kind: 'room', id: 's1' }, p: Plan = plan) {
  const saveNow = vi.fn(() => Promise.resolve(true))
  const openHelp = vi.fn()
  render(
    <EditorProvider initial={{ ...initEditor(p, site), selection }}>
      <Sonde saveNow={saveNow} openHelp={openHelp} />
    </EditorProvider>,
  )
  return { saveNow, openHelp }
}
const touche = (key: string, init: KeyboardEventInit = {}, cible: Element | Window = window) =>
  fireEvent.keyDown(cible, { key, ...init })
const salle = () => currentLevel(h.etat).rooms[0]!

describe('useShortcuts', () => {
  it('flèche droite : pièce x + 10, Maj + flèche : x + 1, une entrée d\'historique par appui', () => {
    monter()
    touche('ArrowRight')
    expect(salle().rect.x).toBe(510)
    expect(h.etat.past).toHaveLength(1)
    touche('ArrowRight', { shiftKey: true })
    expect(salle().rect.x).toBe(511)
    expect(h.etat.past).toHaveLength(2)
    touche('ArrowUp')
    expect(salle().rect.y).toBe(490)
  })
  it('déplace un meuble, et une ouverture le long de son mur seulement', () => {
    monter({ kind: 'furniture', id: 'f1' })
    touche('ArrowDown')
    expect(currentLevel(h.etat).furniture[0]!.y).toBe(560)
  })
  it('ouverture horizontale : gauche/droite la glissent, haut/bas sont ignorées', () => {
    monter({ kind: 'opening', id: 'o1' })
    touche('ArrowRight')
    expect(currentLevel(h.etat).openings[0]!.start).toBe(610)
    touche('ArrowUp')
    expect(h.etat.past).toHaveLength(1)
  })
  it('Ctrl+Z annule ; Ctrl+Maj+Z et Ctrl+Y rétablissent', () => {
    monter()
    touche('ArrowRight')
    touche('z', { ctrlKey: true })
    expect(salle().rect.x).toBe(500)
    touche('z', { ctrlKey: true, shiftKey: true })
    expect(salle().rect.x).toBe(510)
    touche('z', { metaKey: true })
    expect(salle().rect.x).toBe(500)
    touche('y', { ctrlKey: true })
    expect(salle().rect.x).toBe(510)
  })
  it('Suppr supprime la pièce sélectionnée ; Retour arrière aussi', () => {
    monter()
    touche('Delete')
    expect(currentLevel(h.etat).rooms).toHaveLength(0)
  })
  it('Suppr sans sélection ne fait rien', () => {
    monter(null)
    touche('Delete')
    expect(h.etat.past).toHaveLength(0)
  })
  it('Échap : désarme le meuble, sinon désélectionne', () => {
    monter()
    touche('Escape')
    expect(h.etat.selection).toBeNull()
  })
  it('lettres d\'outils, insensibles à la casse ; E ignorée sans étage', () => {
    monter()
    touche('p')
    expect(h.etat.tool).toBe('room')
    touche('D')
    expect(h.etat.tool).toBe('door')
    touche('e')
    expect(h.etat.tool).toBe('door')
    touche('v', { ctrlKey: true })
    expect(h.etat.tool).toBe('door')
  })
  it('E sélectionne l\'escalier avec un étage', () => {
    monter(null, avecEtage)
    touche('e')
    expect(h.etat.tool).toBe('stairs')
  })
  it('R tourne le meuble sélectionné', () => {
    monter({ kind: 'furniture', id: 'f1' })
    touche('r')
    expect(currentLevel(h.etat).furniture[0]!.rotation).toBe(90)
  })
  it('? ouvre l\'aide', () => {
    const { openHelp } = monter()
    touche('?', { shiftKey: true })
    expect(openHelp).toHaveBeenCalledOnce()
  })
  it('ignorés quand le focus est dans un champ', () => {
    monter()
    const champ = screen.getByLabelText('champ')
    touche('ArrowRight', {}, champ)
    touche('p', {}, champ)
    touche('Delete', {}, champ)
    expect(h.etat.past).toHaveLength(0)
    expect(h.etat.tool).toBe('select')
  })
  it('ignorés dans une boîte de dialogue', () => {
    monter()
    const dlg = document.body.appendChild(document.createElement('div'))
    dlg.setAttribute('role', 'dialog')
    const b = dlg.appendChild(document.createElement('button'))
    touche('p', {}, b)
    expect(h.etat.tool).toBe('select')
    dlg.remove()
  })
  it('Ctrl+S appelle saveNow et empêche le comportement du navigateur, même dans un champ', () => {
    const { saveNow } = monter()
    const ev = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })
    screen.getByLabelText('champ').dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(saveNow).toHaveBeenCalledOnce()
  })
})

describe('Ctrl+S dans l\'éditeur', () => {
  it('« 4,5 » tapé en largeur sans quitter le champ, Ctrl+S : le PUT contient w 450', async () => {
    const puts: Plan[] = []
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ id: 'u1', email: 'a@b.fr', role: 'user' })),
      http.get('/api/projects', () => HttpResponse.json([])),
      http.get('/api/projects/:id', () => HttpResponse.json({
        id: 'p1', name: 'Alpha', site, rules: DEFAULT_RULE_PARAMS, createdAt: 'x', updatedAt: 'x',
      })),
      http.get('/api/projects/:id/plan', () => HttpResponse.json({ plan, validation: { violations: [], checkedAt: 'x' } })),
      http.put('/api/projects/:id/plan', async ({ request }) => {
        puts.push((await request.json()) as Plan)
        return HttpResponse.json({ validation: { violations: [], checkedAt: 'x' } })
      }),
    )
    const { container } = renderApp('/projets/p1')
    await screen.findByRole('img', { name: 'Plan du projet' })
    const piece = container.querySelector('[data-room="s1"]') as Element
    await userEvent.pointer([{ keys: '[MouseLeft>]', target: piece }, { keys: '[/MouseLeft]', target: piece }])
    const f = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(f)
    await userEvent.type(f, '4,5')
    expect(puts).toHaveLength(0)
    await act(async () => { fireEvent.keyDown(f, { key: 's', ctrlKey: true }) })
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]!.levels[0]!.rooms[0]!.rect.w).toBe(450)
  })
})
