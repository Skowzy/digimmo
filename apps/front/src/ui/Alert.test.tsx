import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Alert } from './Alert'

describe('Alert', () => {
  it('erreur ⇒ role alert', () => {
    render(<Alert title="Échec">Connexion impossible</Alert>)
    expect(screen.getByRole('alert')).toHaveTextContent('Connexion impossible')
  })
  it('autres tons ⇒ role status', () => {
    render(<Alert tone="info">Information</Alert>)
    expect(screen.getByRole('status')).toHaveTextContent('Information')
  })
})
