import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('rend le h1, le sous-titre et les actions', () => {
    render(<PageHeader title="Mes projets" subtitle="Trois projets" actions={<button>Nouveau</button>} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Mes projets' })).toBeInTheDocument()
    expect(screen.getByText('Trois projets')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nouveau' })).toBeInTheDocument()
  })
})
