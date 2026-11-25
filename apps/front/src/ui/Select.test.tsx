import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

const options = [{ value: 'north', label: 'Nord' }, { value: 'south', label: 'Sud' }]

describe('Select', () => {
  it('relie le libellé à la liste et affiche les options', () => {
    render(<Select label="Côté de la voie" options={options} defaultValue="south" />)
    const select = screen.getByLabelText('Côté de la voie')
    expect(select.tagName).toBe('SELECT')
    expect(select).toHaveValue('south')
    expect(screen.getByRole('option', { name: 'Nord' })).toBeInTheDocument()
  })

  it('transmet les props natives (onChange, disabled)', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<Select label="Côté" options={options} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByLabelText('Côté'), 'south')
    expect(onChange).toHaveBeenCalledTimes(1)
    rerender(<Select label="Côté" options={options} disabled />)
    expect(screen.getByLabelText('Côté')).toBeDisabled()
  })

  it("expose l'erreur et l'aide au lecteur d'écran", () => {
    render(<Select label="Côté" options={options} error="Choix invalide" hint="Côté de la rue" />)
    const select = screen.getByLabelText('Côté')
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAccessibleDescription('Choix invalide Côté de la rue')
  })

  it("utilise l'id fourni pour le message", () => {
    render(<Select id="x" label="A" options={options} error="Oups" />)
    expect(document.getElementById('x-erreur')).toHaveTextContent('Oups')
  })

  it('sans violation axe', async () => {
    const { container } = render(<Select label="Côté" options={options} error="Oups" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
