import { useEffect, useRef, useState } from 'react'
import { FlashMessage } from '../app/FlashMessage'
import { usePlan, useDeleteProject, useProjects } from '../lib/queries'
import type { ProjectDto } from '../lib/queries'
import { Alert, Button, ButtonLink, Modal, PageHeader } from '../ui'
import { ProjectCard } from '../ui/ProjectCard'
import styles from './DashboardPage.module.css'
import { useEnvoiUnique } from './useEnvoiUnique'

function CarteProjet({ project, onDelete }: { project: ProjectDto; onDelete: () => void }) {
  const { data, isError } = usePlan(project.id)
  return (
    <ProjectCard
      project={project}
      plan={data?.plan}
      violations={data?.validation.violations}
      planState={isError ? 'error' : data ? 'ok' : 'loading'}
      onDelete={onDelete}
    />
  )
}

export function DashboardPage() {
  const { data: projets, isPending, error } = useProjects()
  const suppression = useDeleteProject()
  const verrou = useEnvoiUnique()
  const [aSupprimer, setASupprimer] = useState<ProjectDto | null>(null)
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null)

  const titre = useRef<HTMLHeadingElement>(null)
  const [focusTitre, setFocusTitre] = useState(0)
  // La carte (déclencheur) disparaît après suppression : le focus va au titre de la page.
  useEffect(() => {
    if (focusTitre > 0) titre.current?.focus()
  }, [focusTitre])

  function confirmer() {
    if (!aSupprimer || verrou.occupe()) return
    verrou.prendre()
    suppression.mutate(aSupprimer.id, {
      onSettled: verrou.liberer,
      onSuccess: () => {
        setASupprimer(null)
        setFocusTitre((n) => n + 1)
      },
      onError: (e) => setErreurSuppression(e instanceof Error ? e.message : 'Erreur inattendue.'),
    })
  }

  function fermer() {
    if (verrou.occupe()) return
    setASupprimer(null)
    setErreurSuppression(null)
  }

  return (
    <div>
      <FlashMessage />
      <PageHeader title="Mes projets" titleRef={titre} actions={<ButtonLink to="/projets/nouveau">Nouveau projet</ButtonLink>} />
      {error && <Alert>{error.message}</Alert>}
      {isPending && !error && (
        <div className={styles.grille} aria-busy="true">
          <div className={styles.squelette} />
          <div className={styles.squelette} />
        </div>
      )}
      {projets && projets.length === 0 && (
        <div className={styles.vide}>
          <p>Aucun projet pour l'instant.</p>
          <ButtonLink to="/projets/nouveau">Nouveau projet</ButtonLink>
        </div>
      )}
      {projets && projets.length > 0 && (
        <div className={styles.grille}>
          {projets.map((p) => (
            <CarteProjet key={p.id} project={p} onDelete={() => setASupprimer(p)} />
          ))}
        </div>
      )}
      <Modal
        open={aSupprimer !== null}
        title="Supprimer le projet"
        onClose={fermer}
        footer={
          <>
            <Button variant="secondary" onClick={fermer}>Annuler</Button>
            <Button variant="danger" loading={suppression.isPending} onClick={confirmer}>Supprimer</Button>
          </>
        }
      >
        <p>Supprimer le projet « {aSupprimer?.name} » ? Cette action est définitive.</p>
        {erreurSuppression && <Alert>{erreurSuppression}</Alert>}
      </Modal>
    </div>
  )
}
