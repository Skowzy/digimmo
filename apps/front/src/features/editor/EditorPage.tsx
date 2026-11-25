import { Link, useParams } from 'react-router'
import { useTitrePage } from '../../app/useTitrePage'
import { ApiError } from '../../lib/api'
import { usePlan, useProject } from '../../lib/queries'
import { Alert, Button, ButtonLink, PageHeader } from '../../ui'
import styles from './EditorPage.module.css'
import { EditorProvider } from './state/EditorContext'
import { initEditor } from './state/reducer'

export function EditorPage() {
  const { id = '' } = useParams()
  const projet = useProject(id)
  const plan = usePlan(id)
  useTitrePage(projet.data?.name ?? 'Éditeur')

  if (!projet.data && projet.isError) {
    const introuvable = projet.error instanceof ApiError && projet.error.status === 404
    return (
      <div>
        <PageHeader title="Projet" />
        <Alert>{introuvable ? 'Projet introuvable.' : projet.error.message}</Alert>
        <ButtonLink to="/projets">Retour au tableau de bord</ButtonLink>
      </div>
    )
  }
  if (!plan.data && plan.isError) {
    return (
      <div>
        <PageHeader title="Projet" />
        <Alert>Impossible de charger le plan.</Alert>
        <Button onClick={() => void plan.refetch()}>Réessayer</Button>
      </div>
    )
  }
  if (!projet.data || !plan.data) {
    return <div><PageHeader title="Projet" /><p role="status">Chargement du plan…</p></div>
  }

  const initial = initEditor(plan.data.plan, projet.data.site)

  return (
    <EditorProvider key={id} initial={initial}>
    <div className={styles.page}>
      <header className={styles.entete}>
        <h1 className={styles.titre}>{projet.data.name}</h1>
        <Link to={`/projets/${id}/parametres`}>Paramètres du projet</Link>
        <div className={styles.sauvegarde} data-slot="sauvegarde" />
      </header>
      <p className={styles.etroit}>L'éditeur est prévu pour un écran d'ordinateur.</p>
      <div className={styles.zones}>
        <div className={styles.outils} role="toolbar" aria-label="Outils" />
        <div className={styles.canvas}>
          <svg role="img" aria-label="Plan du projet" className={styles.svg} viewBox="0 0 1000 800" />
        </div>
        <aside className={styles.panneaux} aria-label="Panneaux">
          <section aria-labelledby="ed-proprietes"><h2 id="ed-proprietes">Propriétés</h2></section>
          <section aria-labelledby="ed-regles"><h2 id="ed-regles">Règles</h2></section>
        </aside>
      </div>
    </div>
    </EditorProvider>
  )
}
