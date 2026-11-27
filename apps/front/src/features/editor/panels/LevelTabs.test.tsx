import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RULE_PARAMS, parsePlan, rectangularSite, validatePlan, type Plan, type Room } from '@digimmo/domain'
import { PlanCanvas } from '../canvas/PlanCanvas'
import { EditorProvider } from '../state/EditorContext'
import { initEditor } from '../state/reducer'
import type { EditorState } from '../state/types'
import { useEditor } from '../state/useEditor'
import { LevelTabs } from './LevelTabs'
import { PropertiesPanel } from './PropertiesPanel'
import { RulesPanel } from './RulesPanel'
import { Toolbar } from './Toolbar'

const site = rectangularSite(2000, 3000, 'south')
const salon: Room = { id: 's1', type: 'sejour', name: 'Salon', rect: { x: 500, y: 500, w: 600, h: 400 } }
const base: Plan = { levels: [{ id: 'rdc', rooms: [salon], openings: [], furniture: [] }], stairs: null }
const avecEtage: Plan = {
  levels: [...base.levels, { id: 'r1', rooms: [{ ...salon, id: 'e1', name: 'Chambre' }], openings: [], furniture: [] }],
  stairs: null,
}

const h = {} as { etat: EditorState }
function Sonde() {
  const e = useEditor()
  useEffect(() => { h.etat = e.state })
  return null
}
function Regles() {
  const { state } = useEditor()
  return <RulesPanel violations={validatePlan(site, DEFAULT_RULE_PARAMS, state.plan)} />
}
function monter(plan: Plan = base) {
  render(
    <EditorProvider initial={initEditor(plan, site)}>
      <Toolbar />
      <LevelTabs />
      <PlanCanvas site={site} rules={DEFAULT_RULE_PARAMS} violations={[]} />
      <PropertiesPanel />
      <Regles />
      <Sonde />
    </EditorProvider>,
  )
}
const svg = () => screen.getByRole('img', { name: 'Plan du projet' })
const pt = (x: number, y: number) => ({ pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y })
const glisser = (a: [number, number], b: [number, number]) => {
  fireEvent.pointerDown(svg(), pt(...a))
  fireEvent.pointerMove(svg(), pt(...b))
  fireEvent.pointerUp(svg(), pt(...b))
}
const escalierEl = () => document.querySelector('[data-stairs]')

describe('niveaux', () => {
  it('plain-pied : pas d\'onglets, « + Étage » les fait apparaître, passe sur l\'étage et le focalise', async () => {
    monter()
    expect(screen.queryByRole('tablist')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '+ Étage' }))
    const onglets = within(screen.getByRole('tablist', { name: 'Niveaux' })).getAllByRole('tab')
    expect(onglets.map((o) => o.textContent)).toEqual(['Rez-de-chaussée', 'Étage'])
    expect(screen.getByRole('tab', { name: 'Étage' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Étage' })).toHaveFocus()
    expect(h.etat.levelId).toBe('r1')
  })

  it('flèches gauche/droite changent d\'onglet et activent le niveau', async () => {
    monter(avecEtage)
    const rdc = screen.getByRole('tab', { name: 'Rez-de-chaussée' })
    expect(rdc).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Étage' })).toHaveAttribute('tabindex', '-1')
    rdc.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Étage' })).toHaveFocus()
    expect(h.etat.levelId).toBe('r1')
    await userEvent.keyboard('{ArrowLeft}')
    expect(rdc).toHaveFocus()
    expect(h.etat.levelId).toBe('rdc')
  })

  it('retirer l\'étage : sans confirmer rien ne change ; confirmé, onglets disparus et plan valide', async () => {
    monter({ ...avecEtage, stairs: { rect: { x: 100, y: 100, w: 100, h: 300 } } })
    await userEvent.click(screen.getByRole('button', { name: "Retirer l'étage" }))
    const modal = await screen.findByRole('dialog', { name: "Retirer l'étage ?" })
    expect(within(modal).getByText("Ses pièces, ses ouvertures, ses meubles et l'escalier seront supprimés.")).toBeInTheDocument()
    await userEvent.click(within(modal).getByRole('button', { name: 'Annuler' }))
    expect(h.etat.plan.levels).toHaveLength(2)
    expect(screen.getByRole('tablist')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: "Retirer l'étage" }))
    const modal2 = await screen.findByRole('dialog', { name: "Retirer l'étage ?" })
    await userEvent.click(within(modal2).getByRole('button', { name: "Retirer l'étage" }))
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(h.etat.plan.stairs).toBeNull()
    expect(h.etat.plan.levels).toHaveLength(1)
    expect(h.etat.past).toHaveLength(1)
    expect(parsePlan(h.etat.plan).ok).toBe(true)
    expect(screen.getByRole('button', { name: '+ Étage' })).toHaveFocus()
  })

  it('annuler après le retrait rétablit l\'étage, l\'escalier et les onglets', async () => {
    monter({ ...avecEtage, stairs: { rect: { x: 100, y: 100, w: 100, h: 300 } } })
    await userEvent.click(screen.getByRole('button', { name: "Retirer l'étage" }))
    const modal = await screen.findByRole('dialog', { name: "Retirer l'étage ?" })
    await userEvent.click(within(modal).getByRole('button', { name: "Retirer l'étage" }))
    expect(screen.queryByRole('tablist')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(h.etat.plan.levels).toHaveLength(2)
    expect(h.etat.plan.stairs).toEqual({ rect: { x: 100, y: 100, w: 100, h: 300 } })
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })
})

describe('escalier', () => {
  it('l\'outil Escalier est désactivé sans étage, actif avec', () => {
    monter()
    expect(screen.getByRole('button', { name: 'Escalier (E)' })).toBeDisabled()
  })

  it('dessiné au RDC, l\'escalier apparaît aussi sur l\'étage (marches + « Monte »)', async () => {
    monter(avecEtage)
    await userEvent.click(screen.getByRole('tab', { name: 'Rez-de-chaussée' }))
    await userEvent.click(screen.getByRole('button', { name: 'Escalier (E)' }))
    glisser([100, 100], [200, 400])
    expect(h.etat.plan.stairs?.rect).toEqual({ x: 100, y: 100, w: 100, h: 300 })
    expect(h.etat.selection).toEqual({ kind: 'stairs', id: 'stairs' })
    expect(h.etat.tool).toBe('select')
    expect(escalierEl()!.querySelectorAll('line[class*="marche"]')).toHaveLength(11) // 300 cm / 25 cm, moins le bord
    expect(within(escalierEl() as HTMLElement).getByText('Monte')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Étage' }))
    expect(escalierEl()).not.toBeNull()
    expect(escalierEl()!.closest('[class*="fantome"]')).toBeNull()
  })

  it('un glisser plat (2 m × 0) donne une pièce et un escalier de 50 cm minimum', async () => {
    monter(avecEtage)
    await userEvent.click(screen.getByRole('button', { name: 'Pièce (P)' }))
    glisser([1000, 1000], [1200, 1000])
    const r = h.etat.plan.levels.find((l) => l.id === 'rdc')!.rooms.at(-1)!.rect
    expect(r).toEqual({ x: 1000, y: 1000, w: 200, h: 50 })
    await userEvent.click(screen.getByRole('button', { name: 'Escalier (E)' }))
    glisser([1000, 1500], [1200, 1500])
    expect(h.etat.plan.stairs?.rect).toEqual({ x: 1000, y: 1500, w: 200, h: 50 })
    await userEvent.click(screen.getByRole('button', { name: 'Escalier (E)' }))
    glisser([1500, 2000], [1300, 2000]) // vers la gauche : étendu dans le sens du glisser
    expect(h.etat.plan.stairs?.rect).toEqual({ x: 1300, y: 2000, w: 200, h: 50 })
  })

  it('un clic dessine un escalier 100 × 300 centré', async () => {
    monter(avecEtage)
    await userEvent.click(screen.getByRole('button', { name: 'Escalier (E)' }))
    glisser([1000, 1000], [1001, 1001])
    expect(h.etat.plan.stairs?.rect).toEqual({ x: 950, y: 850, w: 100, h: 300 })
  })

  it('sélection, déplacement, redimensionnement et suppression', async () => {
    monter({ ...avecEtage, stairs: { rect: { x: 1200, y: 1200, w: 100, h: 300 } } })
    fireEvent.pointerDown(escalierEl()!, pt(1250, 1300))
    expect(h.etat.selection).toEqual({ kind: 'stairs', id: 'stairs' })
    fireEvent.pointerMove(svg(), pt(1350, 1400))
    fireEvent.pointerUp(svg(), pt(1350, 1400))
    expect(h.etat.plan.stairs?.rect).toEqual({ x: 1300, y: 1300, w: 100, h: 300 })
    const poignee = document.querySelector('[data-handle="se"]')!
    fireEvent.pointerDown(poignee, pt(1400, 1600))
    fireEvent.pointerMove(svg(), pt(1500, 1700))
    fireEvent.pointerUp(svg(), pt(1500, 1700))
    expect(h.etat.plan.stairs?.rect).toEqual({ x: 1300, y: 1300, w: 200, h: 400 })
    await userEvent.click(screen.getByRole('button', { name: "Supprimer l'escalier" }))
    expect(h.etat.plan.stairs).toBeNull()
  })

  it('propriétés : X, Y, largeur et longueur', async () => {
    monter({ ...avecEtage, stairs: { rect: { x: 1200, y: 1200, w: 100, h: 300 } } })
    fireEvent.pointerDown(escalierEl()!, pt(1250, 1300))
    fireEvent.pointerUp(svg(), pt(1250, 1300))
    const longueur = screen.getByLabelText('Longueur (m)')
    await userEvent.clear(longueur)
    await userEvent.type(longueur, '4{Enter}')
    expect(h.etat.plan.stairs?.rect.h).toBe(400)
    const largeur = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(largeur)
    await userEvent.type(largeur, '0,2{Enter}')
    expect(h.etat.plan.stairs?.rect.w).toBe(100)
    expect(screen.getByText('Valeur entre 0,50 m et 988,00 m')).toBeInTheDocument()
  })

  it('un étage sans escalier fait apparaître l\'alerte', () => {
    monter(avecEtage)
    expect(screen.getByText('Il y a un étage mais pas d\'escalier.')).toBeInTheDocument()
  })
})
