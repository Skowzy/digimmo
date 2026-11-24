import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RuleBadge } from './RuleBadge'

describe('RuleBadge', () => {
  it('annonce la sévérité et le texte', () => {
    const { container } = render(<RuleBadge severity="error">Chambre 1 &lt; 9 m²</RuleBadge>)
    const badge = screen.getByText(/Chambre 1/).closest('span.badge') as HTMLElement
    expect(badge).toHaveTextContent('Erreur')
    expect(badge).toHaveTextContent('Chambre 1 < 9 m²')
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('✗')
  })
})
