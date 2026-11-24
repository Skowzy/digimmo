import { screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/render'

describe('DesignSystemPage', () => {
  it('affiche les tokens et les variantes de bouton', () => {
    renderApp('/design-system')
    for (const t of ['papier', 'papier-2', 'trait', 'encre', 'encre-2', 'sanguine', 'sauge', 'ocre', 'blanc'])
      expect(screen.getByText(t, { selector: 'code' })).toBeInTheDocument()
    for (const n of ['Enregistrer', 'Exporter en PDF', 'Annuler', 'Supprimer le projet'])
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument()
  })

  it('affiche les liens-boutons', () => {
    renderApp('/design-system')
    expect(screen.getByRole('heading', { name: 'Liens-boutons' })).toBeInTheDocument()
    for (const n of ['Nouveau projet', 'Voir les projets', 'Retour'])
      expect(screen.getByRole('link', { name: n })).toHaveAttribute('href', '/design-system')
  })

  it("n'a pas de violation d'accessibilité", async () => {
    const { container } = renderApp('/design-system')
    expect(await axe(container)).toHaveNoViolations()
  })
})
