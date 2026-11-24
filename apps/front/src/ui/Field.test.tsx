import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from './Field'

describe('Field', () => {
  it('relie le libellé au champ', () => {
    render(<Field label="Largeur du terrain" />)
    expect(screen.getByLabelText('Largeur du terrain')).toBeInTheDocument()
  })

  it("expose l'erreur au lecteur d'écran", () => {
    render(<Field label="Recul minimal" error="Le PLU impose au moins 3 m" />)
    const input = screen.getByLabelText('Recul minimal')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Le PLU impose au moins 3 m')
  })

  it("utilise l'id fourni pour le message", () => {
    render(<Field id="x" label="A" error="Oups" />)
    expect(document.getElementById('x-erreur')).toHaveTextContent('Oups')
  })
})
