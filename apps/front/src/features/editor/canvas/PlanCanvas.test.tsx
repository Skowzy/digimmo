import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RULE_PARAMS, rectangularSite, type Plan, type Violation } from '@digimmo/domain'
import { PlanCanvas } from './PlanCanvas'
import { EditorProvider } from '../state/EditorContext'
import { initEditor } from '../state/reducer'
import { useEditor } from '../state/useEditor'

const site = rectangularSite(2000, 3000, 'south')
const salon = { id: 's1', type: 'sejour' as const, name: 'Salon', rect: { x: 500, y: 500, w: 600, h: 400 } }
const plan: Plan = { levels: [{ id: 'rdc', rooms: [salon], openings: [], furniture: [] }], stairs: null }
const plan2: Plan = {
  levels: [...plan.levels, { id: 'r1', rooms: [], openings: [], furniture: [] }], stairs: null,
}

function monter(p: Plan = plan, violations: Violation[] = [], levelId: 'rdc' | 'r1' = 'rdc') {
  const initial = { ...initEditor(p, site), levelId }
  return render(
    <EditorProvider initial={initial}>
      <PlanCanvas site={site} rules={DEFAULT_RULE_PARAMS} violations={violations} />
    </EditorProvider>,
  )
}
const largeur = () => Number(screen.getByRole('img', { name: 'Plan du projet' }).getAttribute('viewBox')!.split(' ')[2])

describe('PlanCanvas', () => {
  it('rend une pièce avec son nom et sa surface', () => {
    monter()
    expect(screen.getByText('Salon')).toBeInTheDocument()
    expect(screen.getByText('24,00 m²')).toBeInTheDocument()
  })

  it('légende les lignes de recul', () => {
    monter()
    expect(screen.getByText('Recul voie 5,00 m')).toBeInTheDocument()
  })

  it('une pièce citée par une erreur porte .enErreur', () => {
    const v: Violation = { code: 'ROOM_MIN_AREA', severity: 'error', message: 'x', refs: ['s1'] }
    const { container } = monter(plan, [v])
    expect(container.querySelector('[data-room="s1"]')?.getAttribute('class')).toMatch(/enErreur/)
  })

  it("l'escalier cité par une erreur porte .enErreur et une hachure", () => {
    const v: Violation = { code: 'STAIRS_PLACEMENT', severity: 'error', message: 'x', refs: ['stairs'] }
    const avecEscalier: Plan = { ...plan2, stairs: { rect: { x: 1500, y: 1500, w: 100, h: 300 } } }
    const { container } = monter(avecEscalier, [v], 'r1')
    const g = container.querySelector('[data-stairs]')!
    expect(g.getAttribute('class')).toMatch(/enErreur/)
    expect(g.querySelector('rect[class*="hachure"]')).not.toBeNull()
    const sain = monter(avecEscalier, [], 'r1').container.querySelectorAll('[data-stairs]')
    expect(sain[sain.length - 1]!.getAttribute('class')).not.toMatch(/enErreur/)
  })

  it('un avertissement ne marque pas la pièce', () => {
    const v: Violation = { code: 'FOOTPRINT_NEAR_MAX', severity: 'warning', message: 'x', refs: ['s1'] }
    const { container } = monter(plan, [v])
    expect(container.querySelector('[data-room="s1"]')?.getAttribute('class')).not.toMatch(/enErreur/)
  })

  it('au R+1, les pièces du RDC sont atténuées et non cliquables', () => {
    const { container } = monter(plan2, [], 'r1')
    const fantome = container.querySelector('[data-ghost="s1"]')
    expect(fantome).not.toBeNull()
    expect(fantome?.getAttribute('class')).toMatch(/fantome/)
    expect(container.querySelector('[data-room="s1"]')).toBeNull()
  })

  it('Zoom avant réduit la largeur de vue d\'un facteur 1,2', async () => {
    monter()
    const avant = largeur()
    await userEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
    expect(largeur()).toBeCloseTo(avant / 1.2, 1)
  })

  it('ne dépasse pas 800 %, ni ne descend sous 25 %', async () => {
    monter()
    const ajuste = largeur()
    for (let i = 0; i < 30; i++) await userEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
    expect(largeur()).toBeCloseTo(ajuste / 8, 1)
    for (let i = 0; i < 40; i++) await userEvent.click(screen.getByRole('button', { name: 'Zoom arrière' }))
    expect(largeur()).toBeCloseTo(ajuste * 4, 1)
  })

  it('Ajuster au terrain revient à la vue initiale', async () => {
    monter()
    const initiale = screen.getByRole('img', { name: 'Plan du projet' }).getAttribute('viewBox')
    await userEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ajuster au terrain' }))
    expect(screen.getByRole('img', { name: 'Plan du projet' }).getAttribute('viewBox')).toBe(initiale)
  })

  const svg = () => screen.getByRole('img', { name: 'Plan du projet' })
  const vb = () => svg().getAttribute('viewBox')

  it('molette : le facteur dépend du delta (cran de souris ~1,16, pavé tactile ~1,006)', () => {
    monter()
    const w0 = largeur()
    fireEvent.wheel(svg(), { deltaY: -100 })
    expect(w0 / largeur()).toBeCloseTo(Math.exp(0.15), 2)
    const w1 = largeur()
    fireEvent.wheel(svg(), { deltaY: -4 })
    expect(w1 / largeur()).toBeCloseTo(1.006, 3)
  })

  it('molette : deux événements consécutifs se composent sans rendu intermédiaire', () => {
    monter()
    const w0 = largeur()
    act(() => {
      svg().dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }))
      svg().dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }))
    })
    expect(w0 / largeur()).toBeCloseTo(Math.exp(0.15) ** 2, 2)
  })

  it('Zoom arrière ne zoome pas en avant quand la vue dépasse déjà la borne', async () => {
    monter()
    for (let i = 0; i < 40; i++) await userEvent.click(screen.getByRole('button', { name: 'Zoom arrière' }))
    const max = largeur()
    for (let i = 0; i < 3; i++) fireEvent.wheel(svg(), { deltaY: 100 })
    expect(largeur()).toBeCloseTo(max, 1)
  })

  describe('déplacement', () => {
    const pan = () => {
      vi.spyOn(svg(), 'getBoundingClientRect').mockReturnValue({ width: 1000, height: 800 } as DOMRect)
      fireEvent.pointerDown(svg(), { button: 0, clientX: 100, clientY: 100 })
      fireEvent.pointerMove(svg(), { clientX: 200, clientY: 100 })
      fireEvent.pointerUp(svg())
    }
    it('Espace + glisser déplace la vue', () => {
      monter()
      const avant = vb()
      fireEvent.keyDown(window, { code: 'Space' })
      pan()
      expect(vb()).not.toBe(avant)
    })
    it('le blur de la fenêtre relâche Espace', () => {
      monter()
      const avant = vb()
      fireEvent.keyDown(window, { code: 'Space' })
      fireEvent.blur(window)
      pan()
      expect(vb()).toBe(avant)
    })
  })

  it('une vue modifiée hors du canvas est reprise par le zoom suivant', async () => {
    let envoyer!: ReturnType<typeof useEditor>['dispatch']
    function Sonde() { envoyer = useEditor().dispatch; return null }
    render(
      <EditorProvider initial={initEditor(plan, site)}>
        <PlanCanvas site={site} rules={DEFAULT_RULE_PARAMS} violations={[]} />
        <Sonde />
      </EditorProvider>,
    )
    act(() => envoyer({ type: 'setView', view: { x: 1000, y: 2000, width: 1200, height: 900 } }))
    await userEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
    expect(largeur()).toBeCloseTo(1200 / 1.2, 1)
  })
})
