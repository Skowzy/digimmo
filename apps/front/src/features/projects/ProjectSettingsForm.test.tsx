import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RULE_PARAMS } from '@digimmo/domain'
import { ApiError } from '../../lib/api'
import { ProjectSettingsForm } from './ProjectSettingsForm'
import { VALEURS_PAR_DEFAUT } from './valeursParDefaut'

function rendre(props: Partial<React.ComponentProps<typeof ProjectSettingsForm>> = {}) {
  const onSubmit = vi.fn()
  render(<ProjectSettingsForm initial={VALEURS_PAR_DEFAUT} submitLabel="Créer le projet" onSubmit={onSubmit} pending={false} serverError={null} {...props} />)
  return onSubmit
}

describe('ProjectSettingsForm', () => {
  it('affiche les valeurs par défaut en mètres', () => {
    rendre()
    expect(screen.getByLabelText('Recul sur voie (m)')).toHaveValue('5,00')
    expect(screen.getByLabelText('Recul sur limites séparatives (m)')).toHaveValue('3,00')
    expect(screen.getByLabelText('Emprise au sol max (%)')).toHaveValue('40')
    expect(screen.getByLabelText('Chambre (m²)')).toHaveValue('9')
    expect(screen.getByText('Valeurs indicatives : reportez celles du PLU de votre commune.')).toBeInTheDocument()
  })

  it('largeur invalide : erreur sur le champ, pas de soumission', async () => {
    const onSubmit = rendre()
    await userEvent.type(screen.getByLabelText('Nom du projet'), 'Maison')
    await userEvent.type(screen.getByLabelText('Largeur (m)'), 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Créer le projet' }))
    expect(screen.getByLabelText('Largeur (m)')).toHaveAccessibleDescription(/entre 5,00 et 1 000,00 m/)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('soumission valide : centimètres entiers', async () => {
    const onSubmit = rendre()
    await userEvent.type(screen.getByLabelText('Nom du projet'), '  Maison  ')
    await userEvent.type(screen.getByLabelText('Largeur (m)'), '20,5')
    await userEvent.type(screen.getByLabelText('Profondeur (m)'), '30')
    await userEvent.selectOptions(screen.getByLabelText('Côté de la voie'), 'south')
    await userEvent.click(screen.getByRole('button', { name: 'Créer le projet' }))
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Maison',
      terrain: { widthCm: 2050, depthCm: 3000, street: 'south' },
      rules: DEFAULT_RULE_PARAMS,
    })
  })

  it('double clic rapide : un seul appel', async () => {
    const onSubmit = rendre()
    await userEvent.type(screen.getByLabelText('Nom du projet'), 'Maison')
    await userEvent.type(screen.getByLabelText('Largeur (m)'), '20')
    await userEvent.type(screen.getByLabelText('Profondeur (m)'), '30')
    await userEvent.dblClick(screen.getByRole('button', { name: 'Créer le projet' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('issues serveur : sur le champ, le reste dans l\'alerte', () => {
    rendre({ serverError: new ApiError('Données invalides.', 400, ['terrain.widthCm: trop petit', 'rules.minAreasM2.wc: bof', 'autre: x']) })
    expect(screen.getByLabelText('Largeur (m)')).toHaveAccessibleDescription('trop petit')
    expect(screen.getByLabelText('WC (m²)')).toHaveAccessibleDescription('bof')
    expect(screen.getByRole('alert')).toHaveTextContent('autre: x')
  })

  it('terrain non rectangulaire : alerte et champs désactivés', () => {
    rendre({ terrainFige: true })
    expect(screen.getByRole('status')).toHaveTextContent('Terrain non rectangulaire : modification non prise en charge.')
    expect(screen.getByLabelText('Largeur (m)')).toBeDisabled()
    expect(screen.getByLabelText('Côté de la voie')).toBeDisabled()
  })

  it('axe', async () => {
    const { container } = render(<ProjectSettingsForm initial={VALEURS_PAR_DEFAUT} submitLabel="Créer" onSubmit={() => {}} pending={false} serverError={null} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
