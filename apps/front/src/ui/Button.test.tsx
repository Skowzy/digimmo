import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('applique les classes de variante et de taille', () => {
    render(<Button variant="danger" size="sm">Retirer</Button>)
    const b = screen.getByRole('button', { name: 'Retirer' })
    expect(b).toHaveClass('btn', 'btn--danger', 'btn--sm')
    expect(b).toHaveAttribute('type', 'button')
  })

  it('en chargement : désactivé, aria-busy, pas de clic', async () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Enregistrer</Button>)
    const b = screen.getByRole('button', { name: 'Enregistrer' })
    expect(b).toBeDisabled()
    expect(b).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
  })
})
