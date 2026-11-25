import { fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('ouverte ⇒ dialogue nommé par son titre', () => {
    render(<Modal open title="Supprimer le projet" onClose={() => {}}>Sûr ?</Modal>)
    expect(screen.getByRole('dialog', { name: 'Supprimer le projet' })).toBeInTheDocument()
  })

  it('Échap (événement cancel natif) ⇒ onClose', () => {
    const onClose = vi.fn()
    render(<Modal open title="Supprimer le projet" onClose={onClose}>Sûr ?</Modal>)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("rend le focus à l'élément déclencheur à la fermeture", () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const { rerender } = render(<Modal open title="T" onClose={() => {}}>x</Modal>)
    ;(document.activeElement as HTMLElement).blur()
    rerender(<Modal open={false} title="T" onClose={() => {}}>x</Modal>)
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it('cycle ouverture/fermeture : focus dans le dialogue puis rendu au déclencheur', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const { rerender } = render(<Modal open={false} title="T" onClose={() => {}}>x</Modal>)
    rerender(<Modal open title="T" onClose={() => {}} footer={<button>OK</button>}>x</Modal>)
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    rerender(<Modal open={false} title="T" onClose={() => {}}>x</Modal>)
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it("ne rappelle pas showModal si le dialogue est déjà ouvert (double effet StrictMode)", () => {
    const spy = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    render(<StrictMode><Modal open title="T" onClose={() => {}}>x</Modal></StrictMode>)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
