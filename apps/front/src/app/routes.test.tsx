import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/render'

describe('routes', () => {
  it("affiche l'accueil sur /", () => {
    renderApp('/')
    expect(screen.getByText('Digimmo')).toBeInTheDocument()
  })

  it('affiche « Page introuvable » avec un lien vers l’accueil', () => {
    renderApp('/nimporte')
    expect(
      screen.getByRole('heading', { name: 'Page introuvable' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: "Retour à l'accueil" }),
    ).toHaveAttribute('href', '/')
  })
})
