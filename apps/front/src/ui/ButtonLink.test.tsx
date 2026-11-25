import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ButtonLink } from './ButtonLink'

describe('ButtonLink', () => {
  it('lien react-router au style bouton', () => {
    render(<MemoryRouter><ButtonLink to="/x">Aller</ButtonLink></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Aller' })).toHaveAttribute('href', '/x')
  })
})
