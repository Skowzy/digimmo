import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RULE_PARAMS, rectangularSite, validatePlan, type Plan, type Room } from '@digimmo/domain'
import { PropertiesPanel } from './PropertiesPanel'
import { RulesPanel } from './RulesPanel'
import { EditorProvider } from '../state/EditorContext'
import { currentLevel, initEditor } from '../state/reducer'
import type { EditorState } from '../state/types'
import { useEditor } from '../state/useEditor'

const site = rectangularSite(2000, 3000, 'south')
const salon: Room = { id: 's1', type: 'autre', name: 'Salon', rect: { x: 500, y: 500, w: 400, h: 200 } }
const planDe = (rooms: Room[]): Plan => ({ levels: [{ id: 'rdc', rooms, openings: [], furniture: [] }], stairs: null })

const h = {} as { etat: EditorState; envoyer: ReturnType<typeof useEditor>['dispatch'] }
function Sonde() {
  const e = useEditor()
  useEffect(() => { h.etat = e.state; h.envoyer = e.dispatch })
  return null
}
function Regles() {
  const { state } = useEditor()
  return <RulesPanel violations={validatePlan(site, DEFAULT_RULE_PARAMS, state.plan)} />
}
function monter(selected = true) {
  const initial = initEditor(planDe([salon]), site)
  return render(
    <EditorProvider initial={selected ? { ...initial, selection: { kind: 'room', id: 's1' } } : initial}>
      <PropertiesPanel />
      <Regles />
      <Sonde />
    </EditorProvider>,
  )
}
const salle = () => currentLevel(h.etat).rooms[0]!

describe('PropertiesPanel', () => {
  it('rien de sélectionné : message', () => {
    monter(false)
    expect(screen.getByText('Sélectionnez un élément du plan.')).toBeInTheDocument()
  })
  it('affiche les valeurs de la pièce en mètres et sa surface', () => {
    monter()
    expect(screen.getByLabelText('Nom')).toHaveValue('Salon')
    expect(screen.getByLabelText('Type')).toHaveValue('autre')
    expect(screen.getByLabelText('X (m)')).toHaveValue('5,00')
    expect(screen.getByLabelText('Largeur (m)')).toHaveValue('4,00')
    expect(screen.getByLabelText('Profondeur (m)')).toHaveValue('2,00')
    expect(screen.getByText('8,00 m²')).toBeInTheDocument()
  })
  it('« 4,5 » en largeur puis Tab : w = 450, une seule entrée d\'historique', async () => {
    monter()
    const f = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(f)
    await userEvent.type(f, '4,5')
    await userEvent.tab()
    expect(salle().rect.w).toBe(450)
    expect(h.etat.past).toHaveLength(1)
    expect(f).toHaveValue('4,50')
  })
  it('Entrée valide aussi', async () => {
    monter()
    const f = screen.getByLabelText('Y (m)')
    await userEvent.clear(f)
    await userEvent.type(f, '3{Enter}')
    expect(salle().rect.y).toBe(300)
  })
  it('« abc » : erreur sur le champ, plan inchangé', async () => {
    monter()
    const f = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(f)
    await userEvent.type(f, 'abc')
    await userEvent.tab()
    expect(f).toHaveAccessibleDescription(/Valeur entre/)
    expect(f).toBeInvalid()
    expect(salle().rect.w).toBe(400)
    expect(h.etat.past).toHaveLength(0)
  })
  it('hors bornes : erreur, rien envoyé', async () => {
    monter()
    const f = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(f)
    await userEvent.type(f, '0,3{Enter}')
    expect(f).toBeInvalid()
    expect(salle().rect.w).toBe(400)
  })
  it('Échap restaure la valeur sans valider', async () => {
    monter()
    const f = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(f)
    await userEvent.type(f, '7{Escape}')
    expect(f).toHaveValue('4,00')
    await userEvent.tab()
    expect(salle().rect.w).toBe(400)
  })
  it('le nom est rogné et doit faire 1 à 60 caractères', async () => {
    monter()
    const f = screen.getByLabelText('Nom')
    await userEvent.clear(f)
    await userEvent.type(f, '  Cuisine  {Enter}')
    expect(salle().name).toBe('Cuisine')
    await userEvent.clear(f)
    await userEvent.tab()
    expect(f).toBeInvalid()
    expect(salle().name).toBe('Cuisine')
  })
  it('se resynchronise quand la pièce change ailleurs (annuler)', async () => {
    monter()
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'chambre')
    expect(salle().type).toBe('chambre')
    act(() => h.envoyer({ type: 'updateRoom', id: 's1', changes: { rect: { x: 100, y: 500, w: 400, h: 200 } } }))
    expect(screen.getByLabelText('X (m)')).toHaveValue('1,00')
    act(() => h.envoyer({ type: 'undo' }))
    act(() => h.envoyer({ type: 'select', selection: { kind: 'room', id: 's1' } }))
    expect(screen.getByLabelText('X (m)')).toHaveValue('5,00')
  })
  it('Supprimer la pièce supprime et remet le focus sur le plan', async () => {
    const { container } = monter()
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('aria-label', 'Plan du projet')
    svg.setAttribute('tabindex', '-1')
    container.appendChild(svg)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la pièce' }))
    expect(currentLevel(h.etat).rooms).toHaveLength(0)
    expect(svg).toHaveFocus()
    expect(screen.getByText('Sélectionnez un élément du plan.')).toBeInTheDocument()
  })
})

describe('RulesPanel', () => {
  it('Chambre de 8 m² : violation, clic sélectionne la pièce', async () => {
    monter(false)
    expect(screen.getByRole('heading', { name: 'Règles' })).toBeInTheDocument()
    expect(screen.getByText('Aucun problème détecté')).toBeInTheDocument()
    act(() => h.envoyer({ type: 'select', selection: { kind: 'room', id: 's1' } }))
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'chambre')
    const regles = screen.getByRole('region', { name: /Règles/ })
    const bouton = within(regles).getByRole('button', { name: /fait 8,00 m² : minimum 9,00 m²/ })
    act(() => h.envoyer({ type: 'select', selection: null }))
    await userEvent.click(bouton)
    expect(h.etat.selection).toEqual({ kind: 'room', id: 's1' })
    expect(regles).toHaveAccessibleName(/\d+ (erreur|alerte)/)
  })
  it('axe sans violation', async () => {
    const { container } = monter()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('PropertiesPanel : bornes du repère', () => {
  it("X ne peut pas dépasser 100000 − largeur : message « Valeur entre 0,00 m et … »", async () => {
    monter()
    const f = screen.getByLabelText('X (m)')
    await userEvent.clear(f)
    await userEvent.type(f, '999,5')
    await userEvent.tab()
    expect(screen.getByText(/Valeur entre 0,00 m et 996,00 m/)).toBeInTheDocument()
    expect(salle().rect.x).toBe(500)
  })
  it('la largeur est bornée par la place restante à droite', async () => {
    monter()
    const f = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(f)
    await userEvent.type(f, '999,5')
    await userEvent.tab()
    expect(screen.getByText(/Valeur entre 0,50 m et 995,00 m/)).toBeInTheDocument()
    expect(salle().rect.w).toBe(400)
  })
})

describe('PropertiesPanel : éléments du niveau', () => {
  const plan = (): Plan => ({
    levels: [{
      id: 'rdc', rooms: [salon, { id: 's2', type: 'autre', name: 'Cuisine', rect: { x: 900, y: 500, w: 300, h: 200 } }],
      openings: [
        { id: 'o1', kind: 'door', orientation: 'v', fixed: 900, start: 520, width: 90, swing: { hinge: 'start', side: 'neg' } },
        { id: 'o2', kind: 'window', orientation: 'h', fixed: 500, start: 520, width: 120 },
      ],
      furniture: [{ id: 'f1', catalogId: 'lit', label: 'Lit double', x: 520, y: 520, w: 160, d: 200, rotation: 0 }],
    }],
    stairs: null,
  })
  const monterPlan = () => render(
    <EditorProvider initial={initEditor(plan(), site)}><PropertiesPanel /><Sonde /></EditorProvider>,
  )
  it('liste pièces, ouvertures numérotées et meubles ; le choix sélectionne', async () => {
    monterPlan()
    const choix = screen.getByLabelText('Éléments du niveau')
    const noms = within(choix).getAllByRole('option').map((o) => o.textContent)
    expect(noms).toEqual(expect.arrayContaining(['Salon', 'Cuisine', 'Porte 1', 'Fenêtre 1', 'Lit double']))
    await userEvent.selectOptions(choix, 'Fenêtre 1')
    expect(h.etat.selection).toEqual({ kind: 'opening', id: 'o2' })
    expect(choix).toHaveValue('opening:o2')
  })
  it('clavier seul : choisir une pièce puis changer sa largeur', async () => {
    monterPlan()
    await userEvent.tab()
    expect(screen.getByLabelText('Éléments du niveau')).toHaveFocus()
    await userEvent.selectOptions(screen.getByLabelText('Éléments du niveau'), 'Cuisine')
    const f = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(f)
    await userEvent.type(f, '3,5{Enter}')
    expect(currentLevel(h.etat).rooms[1]!.rect.w).toBe(350)
  })
  it('la valeur suit la sélection faite ailleurs', () => {
    monterPlan()
    act(() => h.envoyer({ type: 'select', selection: { kind: 'furniture', id: 'f1' } }))
    expect(screen.getByLabelText('Éléments du niveau')).toHaveValue('furniture:f1')
  })
  it('axe sans violation', async () => {
    const { container } = monterPlan()
    expect(await axe(container)).toHaveNoViolations()
  })
})
