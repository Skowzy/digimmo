import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RULE_PARAMS, rectangularSite, validatePlan, type Opening, type Plan, type Room } from '@digimmo/domain'
import { PlanCanvas } from './PlanCanvas'
import { PropertiesPanel } from '../panels/PropertiesPanel'
import { EditorProvider } from '../state/EditorContext'
import { currentLevel, initEditor } from '../state/reducer'
import type { EditorState, Tool } from '../state/types'
import { useEditor } from '../state/useEditor'
import userEvent from '@testing-library/user-event'

const site = rectangularSite(2000, 3000, 'south')
const sejour: Room = { id: 's1', type: 'sejour', name: 'Séjour', rect: { x: 300, y: 500, w: 600, h: 400 } }
const chambre: Room = { id: 'c1', type: 'chambre', name: 'Chambre', rect: { x: 300, y: 900, w: 600, h: 300 } }
const planDe = (rooms: Room[], openings: Opening[] = []): Plan => ({ levels: [{ id: 'rdc', rooms, openings, furniture: [] }], stairs: null })

const h = {} as { etat: EditorState; envoyer: ReturnType<typeof useEditor>['dispatch'] }
function Sonde() {
  const e = useEditor()
  useEffect(() => { h.etat = e.state; h.envoyer = e.dispatch })
  return null
}
function monter(plan: Plan, tool: Tool = 'select', selection: EditorState['selection'] = null) {
  render(
    <EditorProvider initial={{ ...initEditor(plan, site), tool, selection }}>
      <PlanCanvas site={site} rules={DEFAULT_RULE_PARAMS} violations={[]} />
      <PropertiesPanel />
      <Sonde />
    </EditorProvider>,
  )
}
const svg = () => screen.getByRole('img', { name: 'Plan du projet' })
const pt = (x: number, y: number) => ({ pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y })
const cliquer = (x: number, y: number) => { fireEvent.pointerDown(svg(), pt(x, y)); fireEvent.pointerUp(svg(), pt(x, y)) }
const ouvertures = () => currentLevel(h.etat).openings
const violations = () => validatePlan(site, DEFAULT_RULE_PARAMS, h.etat.plan)

describe('outil Porte / Fenêtre', () => {
  it('clic sur le mur commun : porte de 90 cm centrée, aimantée, sans violation', () => {
    monter(planDe([sejour, chambre]), 'door')
    cliquer(600, 900)
    expect(ouvertures()).toHaveLength(1)
    expect(ouvertures()[0]).toMatchObject({ kind: 'door', orientation: 'h', fixed: 900, width: 90, start: 560, swing: { hinge: 'start' } })
    expect(violations().filter((v) => v.code.startsWith('OPENING') || v.code === 'DOOR_BLOCKED')).toEqual([])
    expect(h.etat.selection).toEqual({ kind: 'opening', id: ouvertures()[0]!.id })
    expect(h.etat.past).toHaveLength(1)
  })
  it('clic hors de tout mur : rien', () => {
    monter(planDe([sejour, chambre]), 'door')
    cliquer(600, 700)
    expect(ouvertures()).toHaveLength(0)
    expect(h.etat.past).toHaveLength(0)
  })
  it('mur plus court que la largeur par défaut : largeur = longueur du mur', () => {
    const petit: Room = { id: 'p', type: 'wc', name: 'WC', rect: { x: 1000, y: 500, w: 60, h: 200 } }
    monter(planDe([petit]), 'door')
    cliquer(1030, 500)
    expect(ouvertures()[0]).toMatchObject({ width: 60, start: 1000 })
  })
  it('mur de moins de 30 cm : rien', () => {
    const mini: Room = { id: 'p', type: 'wc', name: 'WC', rect: { x: 1000, y: 500, w: 20, h: 200 } }
    monter(planDe([mini]), 'door')
    cliquer(1010, 500)
    expect(ouvertures()).toHaveLength(0)
  })
  it('le côté d\'ouverture pointe vers la pièce cliquée (mur extérieur : sa seule pièce)', () => {
    monter(planDe([sejour]), 'door')
    cliquer(600, 500) // mur du haut du séjour : l'intérieur est en bas (pos)
    expect(ouvertures()[0]!.swing).toEqual({ hinge: 'start', side: 'pos' })
  })
  it('fenêtre : 120 cm, sans swing ; sur un mur intérieur, la violation est listée', () => {
    monter(planDe([sejour, chambre]), 'window')
    cliquer(600, 900)
    expect(ouvertures()[0]).toMatchObject({ kind: 'window', width: 120, start: 540 })
    expect(ouvertures()[0]!.swing).toBeUndefined()
    expect(violations().map((v) => v.message)).toContain('Une fenêtre doit être sur un mur extérieur.')
  })
  it('refuse la 201ᵉ ouverture', () => {
    const deux = Array.from({ length: 200 }, (_, i): Opening => ({ id: `o${i}`, kind: 'window', orientation: 'h', fixed: 500, start: 300, width: 30 }))
    monter(planDe([sejour], deux), 'window')
    cliquer(600, 500)
    expect(screen.getByText('Limite de 200 ouvertures par niveau atteinte.')).toBeInTheDocument()
    expect(ouvertures()).toHaveLength(200)
  })
  it('survol : surligne le segment sous le pointeur, puis aucun', () => {
    monter(planDe([sejour]), 'door')
    fireEvent.pointerMove(svg(), { ...pt(600, 500), buttons: 0 })
    expect(document.querySelector('[data-segment-survol]')).not.toBeNull()
    fireEvent.pointerMove(svg(), { ...pt(600, 700), buttons: 0 })
    expect(document.querySelector('[data-segment-survol]')).toBeNull()
  })
})

describe('déplacement et propriétés d\'une ouverture', () => {
  const porte: Opening = { id: 'o1', kind: 'door', orientation: 'h', fixed: 900, start: 560, width: 90, swing: { hinge: 'start', side: 'pos' } }
  const elPorte = () => document.querySelector('[data-opening="o1"]')!

  it('glisser déplace le long du mur, aimanté, sans changer fixed ; une entrée d\'historique', () => {
    monter(planDe([sejour, chambre], [porte]))
    fireEvent.pointerDown(elPorte(), pt(600, 900))
    fireEvent.pointerMove(svg(), pt(703, 1000)) // dérive perpendiculaire ignorée
    fireEvent.pointerUp(svg(), pt(703, 1000))
    expect(ouvertures()[0]).toMatchObject({ fixed: 900, start: 660 })
    expect(h.etat.past).toHaveLength(1)
    expect(h.etat.selection).toEqual({ kind: 'opening', id: 'o1' })
  })
  it('reste bornée au segment', () => {
    monter(planDe([sejour, chambre], [porte]))
    fireEvent.pointerDown(elPorte(), pt(600, 900))
    fireEvent.pointerMove(svg(), pt(5000, 900))
    fireEvent.pointerUp(svg(), pt(5000, 900))
    expect(ouvertures()[0]!.start).toBe(810)
  })
  it('Échap annule le glissement', () => {
    monter(planDe([sejour, chambre], [porte]))
    fireEvent.pointerDown(elPorte(), pt(600, 900))
    fireEvent.pointerMove(svg(), pt(700, 900))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(svg(), pt(700, 900))
    expect(ouvertures()[0]!.start).toBe(560)
    expect(h.etat.past).toHaveLength(0)
  })
  it('propriétés : inverser l\'ouverture change side, charnière, largeur, position', async () => {
    monter(planDe([sejour, chambre], [porte]), 'select', { kind: 'opening', id: 'o1' })
    await userEvent.selectOptions(screen.getByLabelText('Ouverture'), 'Côté A')
    expect(ouvertures()[0]!.swing).toEqual({ hinge: 'start', side: 'neg' })
    await userEvent.selectOptions(screen.getByLabelText('Charnière'), 'Fin')
    expect(ouvertures()[0]!.swing).toEqual({ hinge: 'end', side: 'neg' })
    const largeur = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(largeur); await userEvent.type(largeur, '1,00'); await userEvent.tab()
    expect(ouvertures()[0]!.width).toBe(100)
    const pos = screen.getByLabelText('Position (m)')
    await userEvent.clear(pos); await userEvent.type(pos, '5,00'); await userEvent.tab()
    expect(ouvertures()[0]!.start).toBe(500)
    await userEvent.clear(largeur); await userEvent.type(largeur, '9'); await userEvent.tab()
    expect(screen.getByText('Valeur entre 0,30 m et 5,00 m')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la porte' }))
    expect(ouvertures()).toHaveLength(0)
  })
  it('fenêtre : pas de charnière, bouton Supprimer la fenêtre', () => {
    const f: Opening = { id: 'w1', kind: 'window', orientation: 'h', fixed: 500, start: 400, width: 120 }
    monter(planDe([sejour], [f]), 'select', { kind: 'opening', id: 'w1' })
    expect(screen.queryByLabelText('Charnière')).toBeNull()
    expect(screen.getByRole('button', { name: 'Supprimer la fenêtre' })).toBeInTheDocument()
  })
})
