import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { rectangularSite, type Plan, type Violation } from '@digimmo/domain'
import { PropertiesPanel } from './PropertiesPanel'
import { RulesPanel } from './RulesPanel'
import { EditorProvider } from '../state/EditorContext'
import { currentLevel, initEditor } from '../state/reducer'
import type { EditorState } from '../state/types'
import { useEditor } from '../state/useEditor'

const site = rectangularSite(2000, 3000, 'south')
const plan: Plan = {
  levels: [
    { id: 'rdc', rooms: [{ id: 's1', type: 'autre', name: 'Salon', rect: { x: 0, y: 0, w: 400, h: 400 } }],
      openings: [{ id: 'o1', kind: 'door', orientation: 'h', fixed: 0, start: 50, width: 90 }],
      furniture: [{ id: 'f1', catalogId: 'lit', label: 'Lit', x: 10, y: 10, w: 100, d: 100, rotation: 0 }] },
    { id: 'r1', rooms: [{ id: 'e1', type: 'autre', name: 'Chambre haute', rect: { x: 0, y: 0, w: 400, h: 400 } }], openings: [], furniture: [] },
  ],
  stairs: { rect: { x: 0, y: 0, w: 100, h: 200 } },
}
const v = (p: Partial<Violation>): Violation => ({ code: 'ROOM_MIN_AREA', severity: 'error', message: 'msg', refs: [], ...p })

const h = {} as { etat: EditorState; envoyer: ReturnType<typeof useEditor>['dispatch'] }
function Sonde() {
  const e = useEditor()
  useEffect(() => { h.etat = e.state; h.envoyer = e.dispatch })
  return null
}
function monter(violations: Violation[]) {
  return render(
    <EditorProvider initial={initEditor(plan, site)}>
      <PropertiesPanel />
      <RulesPanel violations={violations} />
      <Sonde />
    </EditorProvider>,
  )
}

describe('RulesPanel : navigation', () => {
  it('une ouverture référencée : le panneau affiche « Porte » et Supprimer fonctionne', async () => {
    monter([v({ message: 'Porte gênée', refs: ['o1'], level: 'rdc' })])
    await userEvent.click(screen.getByRole('button', { name: /Porte gênée/ }))
    expect(h.etat.selection).toEqual({ kind: 'opening', id: 'o1' })
    expect(screen.getByRole('heading', { name: 'Porte' })).toBeInTheDocument()
    expect(screen.queryByText('Sélectionnez un élément du plan.')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(currentLevel(h.etat).openings).toHaveLength(0)
  })
  it('meuble et escalier : titres', async () => {
    monter([v({ message: 'M', refs: ['f1'], level: 'rdc' }), v({ message: 'E', refs: ['stairs'] })])
    await userEvent.click(screen.getByRole('button', { name: /: M$/ }))
    expect(screen.getByRole('heading', { name: 'Meuble : Lit' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /: E$/ }))
    expect(h.etat.selection).toEqual({ kind: 'stairs', id: 'stairs' })
    expect(screen.getByRole('heading', { name: 'Escalier' })).toBeInTheDocument()
  })
  it('ref sur l\'autre niveau : bascule le niveau et sélectionne', async () => {
    monter([v({ message: 'Haut', refs: ['e1'], level: 'r1' })])
    await userEvent.click(screen.getByRole('button', { name: /Haut/ }))
    expect(h.etat.levelId).toBe('r1')
    expect(h.etat.selection).toEqual({ kind: 'room', id: 'e1' })
  })
  it('sans level : cherche la ref sur tous les niveaux', async () => {
    monter([v({ message: 'Haut', refs: ['e1'] })])
    await userEvent.click(screen.getByRole('button', { name: /Haut/ }))
    expect(h.etat.levelId).toBe('r1')
    expect(h.etat.selection).toEqual({ kind: 'room', id: 'e1' })
  })
  it('sans refs : non interactif ; erreurs avant alertes ; compte annoncé', () => {
    monter([v({ severity: 'warning', message: 'Alerte A', refs: ['s1'] }), v({ message: 'Site', refs: [] }), v({ message: 'Erreur B', refs: ['s1'] })])
    expect(screen.queryByRole('button', { name: /Site/ })).toBeNull()
    expect(screen.getByText(/Site/)).toBeInTheDocument()
    const items = screen.getAllByRole('listitem').map((l) => l.textContent ?? '')
    expect(items[0]).toMatch(/Site/)
    expect(items[1]).toMatch(/Erreur B/)
    expect(items[2]).toMatch(/Alerte A/)
    expect(screen.getByRole('heading', { name: 'Règles (2 erreurs, 1 alerte)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Règles/ }).closest('[aria-live="polite"]')).not.toBeNull()
  })
})

describe('axe', () => {
  it('liste de règles remplie', async () => {
    const { container } = monter([v({ message: 'Erreur', refs: ['s1'] }), v({ severity: 'warning', message: 'Alerte', refs: [] })])
    expect(await axe(container)).toHaveNoViolations()
  })
  it('champ invalide affiché', async () => {
    const { container } = monter([])
    act(() => h.envoyer({ type: 'select', selection: { kind: 'room', id: 's1' } }))
    const f = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(f)
    await userEvent.type(f, 'abc')
    await userEvent.tab()
    expect(f).toBeInvalid()
    expect(await axe(container)).toHaveNoViolations()
  })
  it('rien de sélectionné / autre élément sélectionné', async () => {
    const { container } = monter([])
    expect(await axe(container)).toHaveNoViolations()
    act(() => h.envoyer({ type: 'select', selection: { kind: 'opening', id: 'o1' } }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
