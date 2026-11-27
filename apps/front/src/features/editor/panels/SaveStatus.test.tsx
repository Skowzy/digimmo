import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api'
import { SaveStatus } from './SaveStatus'

const base = { saveNow: vi.fn() }

describe('SaveStatus', () => {
  it.each([
    ['saved', 'Enregistré'],
    ['dirty', 'Modifications non enregistrées'],
    ['saving', 'Enregistrement…'],
    ['error', "Échec de l'enregistrement"],
  ] as const)('statut %s', (status, texte) => {
    render(<SaveStatus {...base} status={status} lastError={status === 'error' ? new ApiError('boum', 500) : undefined} />)
    expect(screen.getByRole('status')).toHaveTextContent(texte)
  })

  it('Enregistrer désactivé quand rien à enregistrer, actif sinon', () => {
    const { rerender } = render(<SaveStatus {...base} status="saved" />)
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    rerender(<SaveStatus {...base} status="dirty" />)
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled()
  })

  it('erreur : Réessayer appelle saveNow, issues listées', async () => {
    const saveNow = vi.fn()
    render(<SaveStatus saveNow={saveNow} status="error" lastError={new ApiError('Format de plan invalide.', 400, ['a: b'])} />)
    expect(screen.getByText('a: b')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(saveNow).toHaveBeenCalled()
  })

  it('axe', async () => {
    const { container } = render(<SaveStatus {...base} status="error" lastError={new ApiError('x', 500)} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
