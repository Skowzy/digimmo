import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { ShortcutsDialog } from './ShortcutsDialog'

describe('ShortcutsDialog', () => {
  it('liste les raccourcis dans un tableau Touche / Action', () => {
    render(<ShortcutsDialog open onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Raccourcis clavier' })).toBeInTheDocument()
    const t = screen.getByRole('table', { name: /raccourcis/i })
    expect(within(t).getByRole('columnheader', { name: 'Touche' })).toBeInTheDocument()
    expect(within(t).getByRole('columnheader', { name: 'Action' })).toBeInTheDocument()
    expect(within(t).getByText('Ctrl/Cmd + Z')).toBeInTheDocument()
    expect(within(t).getByText('Maj + flèche')).toBeInTheDocument()
  })
  it('se ferme', async () => {
    const onClose = vi.fn()
    render(<ShortcutsDialog open onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalled()
  })
  it('axe', async () => {
    const { container } = render(<ShortcutsDialog open onClose={() => {}} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
