import { screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import tokens from '../styles/tokens.css?raw'
import { renderApp } from '../test/render'

describe('DesignSystemPage', () => {
  it('affiche les tokens et les variantes de bouton', () => {
    renderApp('/design-system')
    for (const t of ['papier', 'papier-2', 'trait', 'encre', 'encre-2', 'sanguine', 'sauge', 'ocre', 'blanc'])
      expect(screen.getByText(t, { selector: 'code' })).toBeInTheDocument()
    for (const n of ['Enregistrer', 'Exporter en PDF', 'Annuler', 'Supprimer le projet'])
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument()
  })

  it('les valeurs hexadécimales affichées correspondent à tokens.css', () => {
    renderApp('/design-system')
    const noms = ['papier', 'papier-2', 'trait', 'encre', 'encre-2', 'sanguine', 'sauge', 'ocre', 'blanc']
    for (const nom of noms) {
      const attendu = tokens.match(new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
      expect(attendu, `--${nom} dans tokens.css`).toBeDefined()
      const carte = screen.getByText(nom, { selector: 'code' }).parentElement as HTMLElement
      expect(carte.textContent?.toLowerCase(), nom).toContain((attendu as string).toLowerCase())
    }
  })

  it("n'utilise aucun attribut style en ligne", () => {
    const { container } = renderApp('/design-system')
    expect(container.querySelector('[style]')).toBeNull()
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
