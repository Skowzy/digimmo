import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rectangularSite, type Plan } from '@digimmo/domain'
import { EditorProvider } from '../state/EditorContext'
import { initEditor } from '../state/reducer'
import { useEditor } from '../state/useEditor'
import { Toolbar } from './Toolbar'

const site = rectangularSite(2000, 3000, 'south')
const rdc: Plan = { levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }], stairs: null }
const avecEtage: Plan = { ...rdc, levels: [...rdc.levels, { id: 'r1', rooms: [], openings: [], furniture: [] }] }

function Etat() { const { state } = useEditor(); return <output>{state.tool}|{state.past.length}</output> }
function monter(p: Plan = rdc) {
  render(<EditorProvider initial={initEditor(p, site)}><Toolbar /><Etat /></EditorProvider>)
}

describe('Toolbar', () => {
  it('expose les outils avec leur touche', () => {
    monter()
    expect(screen.getByRole('toolbar', { name: 'Outils' })).toBeInTheDocument()
    for (const n of ['Sélection (V)', 'Pièce (P)', 'Porte (D)', 'Fenêtre (F)', 'Meuble (M)', 'Escalier (E)', 'Annuler', 'Rétablir'])
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument()
  })
  it('Sélection est actif au départ et un clic change d\'outil', async () => {
    monter()
    expect(screen.getByRole('button', { name: 'Sélection (V)' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Pièce (P)' }))
    expect(screen.getByRole('button', { name: 'Pièce (P)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('room')
  })
  it('Escalier est désactivé sans étage, Annuler/Rétablir sans historique', () => {
    monter()
    expect(screen.getByRole('button', { name: 'Escalier (E)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rétablir' })).toBeDisabled()
  })
  it('Escalier est actif avec un étage', () => {
    monter(avecEtage)
    expect(screen.getByRole('button', { name: 'Escalier (E)' })).toBeEnabled()
  })
})
