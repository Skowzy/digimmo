import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act, useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RULE_PARAMS, parsePlan, rectangularSite, type Plan, type Room } from '@digimmo/domain'
import { PlanCanvas } from './PlanCanvas'
import { PropertiesPanel } from '../panels/PropertiesPanel'
import { EditorProvider } from '../state/EditorContext'
import { currentLevel, initEditor } from '../state/reducer'
import type { EditorState, Tool } from '../state/types'
import { useEditor } from '../state/useEditor'

const site = rectangularSite(2000, 3000, 'south')
const salon: Room = { id: 's1', type: 'sejour', name: 'Salon', rect: { x: 500, y: 500, w: 600, h: 400 } }
const planDe = (rooms: Room[]): Plan => ({ levels: [{ id: 'rdc', rooms, openings: [], furniture: [] }], stairs: null })

const h = {} as { etat: EditorState; envoyer: ReturnType<typeof useEditor>['dispatch'] }
function Sonde() {
  const e = useEditor()
  useEffect(() => { h.etat = e.state; h.envoyer = e.dispatch })
  return null
}

function monter(rooms: Room[] = [salon], tool: Tool = 'select') {
  render(
    <EditorProvider initial={{ ...initEditor(planDe(rooms), site), tool }}>
      <PlanCanvas site={site} rules={DEFAULT_RULE_PARAMS} violations={[]} />
      <Sonde />
    </EditorProvider>,
  )
}
const svg = () => screen.getByRole('img', { name: 'Plan du projet' })
const pt = (x: number, y: number, extra = {}) => ({ pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y, ...extra })
const rooms = () => currentLevel(h.etat).rooms
const glisser = (el: Element, a: [number, number], b: [number, number]) => {
  fireEvent.pointerDown(el, pt(...a))
  fireEvent.pointerMove(svg(), pt(...b))
  fireEvent.pointerUp(svg(), pt(...b))
}
const salonEl = () => document.querySelector('[data-room="s1"]')!

describe('outil Pièce', () => {
  it('glisser dessine une pièce aimantée, sélectionnée, nommée, puis retour à Sélection', () => {
    monter([], 'room')
    glisser(svg(), [100, 100], [412, 307])
    expect(rooms()).toHaveLength(1)
    expect(rooms()[0]).toMatchObject({ type: 'autre', name: 'Pièce 1', rect: { x: 100, y: 100, w: 310, h: 210 } })
    expect(h.etat.selection).toEqual({ kind: 'room', id: rooms()[0]!.id })
    expect(h.etat.tool).toBe('select')
    expect(h.etat.past).toHaveLength(1)
  })
  it('un simple clic crée une pièce 300 × 300 centrée', () => {
    monter([], 'room')
    glisser(svg(), [1000, 1000], [1001, 1002])
    expect(rooms()[0]!.rect).toEqual({ x: 850, y: 850, w: 300, h: 300 })
  })
  it('affiche un aperçu en pointillé pendant le tracé', () => {
    monter([], 'room')
    fireEvent.pointerDown(svg(), pt(100, 100))
    fireEvent.pointerMove(svg(), pt(300, 300))
    expect(document.querySelector('[class*="apercu"]')).not.toBeNull()
  })
  it('Échap pendant le dessin : aucune pièce, aucun historique', () => {
    monter([], 'room')
    fireEvent.pointerDown(svg(), pt(100, 100))
    fireEvent.pointerMove(svg(), pt(300, 300))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(svg(), pt(300, 300))
    expect(rooms()).toHaveLength(0)
    expect(h.etat.past).toHaveLength(0)
    expect(document.querySelector('[class*="apercu"]')).toBeNull()
  })
  it('refuse la 101ᵉ pièce avec le message de limite', () => {
    const cent = Array.from({ length: 100 }, (_, i): Room => ({
      id: `p${i}`, type: 'autre', name: `P${i}`, rect: { x: (i % 10) * 20, y: Math.floor(i / 10) * 20, w: 20, h: 20 },
    }))
    monter(cent, 'room')
    glisser(svg(), [1000, 1000], [1200, 1200])
    expect(screen.getByText('Limite de 100 pièces par niveau atteinte.')).toBeInTheDocument()
    expect(rooms()).toHaveLength(100)
    act(() => h.envoyer({ type: 'setTool', tool: 'select' }))
    expect(screen.queryByText('Limite de 100 pièces par niveau atteinte.')).toBeNull()
  })
})

describe('outil Sélection', () => {
  it('clic sur une pièce la sélectionne, clic dans le vide désélectionne', () => {
    monter()
    glisser(salonEl(), [600, 600], [600, 600])
    expect(h.etat.selection).toEqual({ kind: 'room', id: 's1' })
    expect(h.etat.past).toHaveLength(0)
    glisser(svg(), [1500, 2500], [1500, 2500])
    expect(h.etat.selection).toBeNull()
  })
  it('glisser déplace la pièce (aimantée) en une seule entrée d\'historique', () => {
    monter()
    glisser(salonEl(), [600, 600], [733, 647])
    expect(rooms()[0]!.rect).toEqual({ x: 630, y: 550, w: 600, h: 400 })
    expect(h.etat.past).toHaveLength(1)
  })
  it('pointercancel au milieu d\'un déplacement : rien ne change', () => {
    monter()
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerMove(svg(), pt(800, 700))
    fireEvent.pointerCancel(svg(), pt(800, 700))
    fireEvent.pointerUp(svg(), pt(800, 700))
    expect(rooms()[0]!.rect).toEqual(salon.rect)
    expect(h.etat.past).toHaveLength(0)
  })
  it('lostpointercapture et Échap annulent aussi', () => {
    monter()
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerMove(svg(), pt(800, 700))
    fireEvent.lostPointerCapture(svg(), pt(800, 700))
    fireEvent.pointerUp(svg(), pt(800, 700))
    expect(rooms()[0]!.rect).toEqual(salon.rect)
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerMove(svg(), pt(800, 700))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(svg(), pt(800, 700))
    expect(rooms()[0]!.rect).toEqual(salon.rect)
    expect(h.etat.past).toHaveLength(0)
  })
  it('huit poignées aria-hidden sur la pièce sélectionnée', () => {
    monter()
    expect(document.querySelectorAll('[data-handle]')).toHaveLength(0)
    glisser(salonEl(), [600, 600], [600, 600])
    expect(document.querySelectorAll('[data-handle]')).toHaveLength(8)
    expect(document.querySelector('[data-handle]')!.closest('[aria-hidden="true"]')).not.toBeNull()
  })
  it('tirer la poignée e modifie la largeur', () => {
    monter()
    glisser(salonEl(), [600, 600], [600, 600])
    glisser(document.querySelector('[data-handle="e"]')!, [1100, 700], [1203, 700])
    expect(rooms()[0]!.rect).toEqual({ x: 500, y: 500, w: 700, h: 400 })
    expect(h.etat.past).toHaveLength(1)
  })
  it('tirer la poignée nw déplace le coin haut-gauche', () => {
    monter()
    glisser(salonEl(), [600, 600], [600, 600])
    glisser(document.querySelector('[data-handle="nw"]')!, [500, 500], [400, 450])
    expect(rooms()[0]!.rect).toEqual({ x: 400, y: 450, w: 700, h: 450 })
  })
  it('Espace + glisser déplace la vue sans bouger la pièce', () => {
    monter()
    vi.spyOn(svg(), 'getBoundingClientRect').mockReturnValue({ width: 1000, height: 800 } as DOMRect)
    fireEvent.keyDown(window, { code: 'Space' })
    glisser(salonEl(), [600, 600], [700, 600])
    expect(rooms()[0]!.rect).toEqual(salon.rect)
  })
})

describe('aimantage : candidats proches uniquement', () => {
  const autre = (y: number): Room => ({ id: 'o1', type: 'autre', name: 'O', rect: { x: 1000, y, w: 300, h: 300 } })
  const largeSvg = () => vi.spyOn(svg(), 'getBoundingClientRect').mockReturnValue({ width: 1000, height: 800 } as DOMRect)
  // Pièce amenée à x = 1007 (bord gauche) : la grille donne 1010, le bord de l'autre pièce (x = 1000) donne 1000.
  it('une pièce voisine attire', () => {
    monter([salon, autre(900)])
    largeSvg()
    glisser(salonEl(), [600, 600], [1107, 600])
    expect(rooms()[0]!.rect.x).toBe(1000)
  })
  it('une pièce de même x mais 5 m plus bas n\'attire pas', () => {
    monter([salon, autre(1400)])
    largeSvg()
    glisser(salonEl(), [600, 600], [1107, 600])
    expect(rooms()[0]!.rect.x).toBe(1010)
  })
})

describe('robustesse des gestes (revue)', () => {
  it('lostpointercapture venu de la pièce (capture implicite) n\'annule pas le déplacement', () => {
    monter()
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerMove(svg(), pt(700, 600))
    fireEvent.lostPointerCapture(salonEl(), pt(700, 600))
    fireEvent.pointerUp(svg(), pt(700, 600))
    expect(rooms()[0]!.rect.x).toBe(600)
  })
  it('un pointercancel d\'un autre doigt n\'annule pas le geste', () => {
    monter()
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerMove(svg(), pt(700, 600))
    fireEvent.pointerCancel(svg(), pt(700, 600, { pointerId: 2 }))
    fireEvent.pointerUp(svg(), pt(700, 600))
    expect(rooms()[0]!.rect.x).toBe(600)
  })
  it('dessin vers les coordonnées négatives : x, y >= 0 et plan valide', () => {
    monter([], 'room')
    glisser(svg(), [-50, -80], [200, 200])
    expect(rooms()[0]!.rect.x).toBeGreaterThanOrEqual(0)
    expect(rooms()[0]!.rect.y).toBeGreaterThanOrEqual(0)
    expect(parsePlan(h.etat.plan).ok).toBe(true)
  })
  it('un clic près de l\'origine reste dans le repère', () => {
    monter([], 'room')
    glisser(svg(), [20, 30], [20, 30])
    expect(rooms()[0]!.rect).toEqual({ x: 0, y: 0, w: 300, h: 300 })
  })
  it('déplacer au-delà de 0 bute à 0', () => {
    monter()
    glisser(salonEl(), [600, 600], [-900, -900])
    expect(rooms()[0]!.rect).toEqual({ x: 0, y: 0, w: 600, h: 400 })
    expect(parsePlan(h.etat.plan).ok).toBe(true)
  })
  it('redimensionner au-delà de 0 plafonne le bord à 0', () => {
    monter()
    glisser(salonEl(), [600, 600], [600, 600])
    glisser(document.querySelector('[data-handle="w"]')!, [500, 700], [-300, 700])
    expect(rooms()[0]!.rect).toEqual({ x: 0, y: 500, w: 1100, h: 400 })
  })
  it('geste périmé : pointermove sans bouton annule, rien n\'est envoyé', () => {
    monter()
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerMove(svg(), pt(700, 600))
    fireEvent.pointerMove(svg(), pt(800, 600, { buttons: 0 }))
    fireEvent.pointerUp(svg(), pt(800, 600, { buttons: 0 }))
    expect(rooms()[0]!.rect).toEqual(salon.rect)
    expect(h.etat.past).toHaveLength(0)
    expect(document.querySelector('[class*="apercu"]')).toBeNull()
  })
  it('un nouveau pointerdown remplace un geste périmé', () => {
    monter()
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerMove(svg(), pt(700, 600))
    fireEvent.pointerUp(svg(), pt(700, 600))
    expect(rooms()[0]!.rect.x).toBe(600)
  })
  it('le blur de la fenêtre annule le geste', () => {
    monter()
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerMove(svg(), pt(700, 600))
    fireEvent.blur(window)
    fireEvent.pointerUp(svg(), pt(700, 600))
    expect(rooms()[0]!.rect).toEqual(salon.rect)
  })
  it('Échap n\'est intercepté que pendant un geste', () => {
    monter()
    const libre = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
    window.dispatchEvent(libre)
    expect(libre.defaultPrevented).toBe(false)
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerMove(svg(), pt(700, 600))
    const actif = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
    act(() => { window.dispatchEvent(actif) })
    expect(actif.defaultPrevented).toBe(true)
  })
  it('petite pièce : les poignées sont plafonnées au tiers de la pièce', () => {
    monter([{ id: 's1', type: 'autre', name: 'P', rect: { x: 1000, y: 1000, w: 60, h: 60 } }])
    glisser(salonEl(), [1030, 1030], [1030, 1030])
    for (const hd of document.querySelectorAll('[data-handle]')) expect(Number(hd.getAttribute('width'))).toBeLessThanOrEqual(20)
  })
  it('le contour de sélection d\'origine est masqué pendant l\'aperçu', () => {
    monter()
    glisser(salonEl(), [600, 600], [600, 600])
    expect(document.querySelector('[class*="selection"]')).not.toBeNull()
    fireEvent.pointerDown(salonEl(), pt(600, 600))
    fireEvent.pointerMove(svg(), pt(700, 600))
    expect(document.querySelector('[class*="selection"]')).toBeNull()
  })
})

describe('saisie en cours dans le panneau', () => {
  it('« 4,5 » tapé en largeur puis clic sur une autre pièce : la première pièce vaut w = 450', async () => {
    const cuisine: Room = { id: 's2', type: 'cuisine', name: 'Cuisine', rect: { x: 1500, y: 500, w: 300, h: 400 } }
    render(
      <EditorProvider initial={{ ...initEditor(planDe([salon, cuisine]), site), selection: { kind: 'room', id: 's1' } }}>
        <PropertiesPanel />
        <PlanCanvas site={site} rules={DEFAULT_RULE_PARAMS} violations={[]} />
        <Sonde />
      </EditorProvider>,
    )
    const f = screen.getByLabelText('Largeur (m)')
    await userEvent.clear(f)
    await userEvent.type(f, '4,5')
    fireEvent.pointerDown(document.querySelector('[data-room="s2"]')!, pt(1600, 600))
    fireEvent.pointerUp(svg(), pt(1600, 600))
    expect(rooms().find((r) => r.id === 's1')!.rect.w).toBe(450)
    expect(h.etat.selection).toEqual({ kind: 'room', id: 's2' })
  })
})
