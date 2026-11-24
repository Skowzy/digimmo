import { useNavigate } from 'react-router'
import { FlashMessage } from '../app/FlashMessage'
import { ProjectSettingsForm } from '../features/projects/ProjectSettingsForm'
import { VALEURS_PAR_DEFAUT } from '../features/projects/valeursParDefaut'
import { useCreateProject } from '../lib/queries'
import { PageHeader } from '../ui'
import { useTitrePage } from '../app/useTitrePage'

export function NewProjectPage() {
  useTitrePage('Nouveau projet')
  const navigate = useNavigate()
  const create = useCreateProject()
  return (
    <div>
      <FlashMessage />
      <PageHeader title="Nouveau projet" />
      <ProjectSettingsForm
        initial={VALEURS_PAR_DEFAUT}
        submitLabel="Créer le projet"
        pending={create.isPending}
        serverError={create.error}
        onSubmit={({ name, terrain, rules }) => {
          if (!terrain) return
          return create.mutateAsync({ name, terrain, rules }).then((p) => navigate(`/projets/${p.id}`), () => undefined)
        }}
      />
    </div>
  )
}
