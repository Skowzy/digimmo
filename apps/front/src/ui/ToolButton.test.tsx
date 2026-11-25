import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToolButton } from './ToolButton'

describe('ToolButton', () => {
  it('actif ⇒ aria-pressed true, nom et info-bulle', () => {
    render(<ToolButton label="Pièce" active icon="⌂" onClick={() => {}} />)
    const b = screen.getByRole('button', { name: 'Pièce' })
    expect(b).toHaveAttribute('aria-pressed', 'true')
    expect(b).toHaveAttribute('title', 'Pièce')
  })

  it('inactif ⇒ aria-pressed false et appelle onClick', async () => {
    const onClick = vi.fn()
    render(<ToolButton label="Terrain" icon="▭" onClick={onClick} />)
    const b = screen.getByRole('button', { name: 'Terrain' })
    expect(b).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(b)
    expect(onClick).toHaveBeenCalled()
  })
})
