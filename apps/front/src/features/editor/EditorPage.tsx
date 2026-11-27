import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { validatePlan, type RuleParams, type Site } from '@digimmo/domain'
import { useTitrePage } from '../../app/useTitrePage'
import { ApiError } from '../../lib/api'
import { useCatalog, usePlan, useProject } from '../../lib/queries'
import { Alert, Button, ButtonLink, PageHeader } from '../../ui'
import styles from './EditorPage.module.css'
import { LevelTabs } from './panels/LevelTabs'
import { CatalogPalette } from './panels/CatalogPalette'
import { PropertiesPanel } from './panels/PropertiesPanel'
import { RulesPanel } from './panels/RulesPanel'
import { Toolbar } from './panels/Toolbar'
import { PlanCanvas } from './canvas/PlanCanvas'
import { EditorProvider } from './state/EditorContext'
import { initEditor, isDirty } from './state/reducer'
import { useEditor } from './state/useEditor'
import { useAutosave } from './save/useAutosave'
import { SaveStatus } from './panels/SaveStatus'
import { LeaveGuard } from './panels/LeaveGuard'
import { ShortcutsDialog } from './panels/ShortcutsDialog'
import { useShortcuts } from './useShortcuts'

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
      <Editeur id={id} nom={projet.data.name} site={projet.data.site} rules={projet.data.rules} />
    </EditorProvider>
  )
}

function Editeur({ id, nom, site, rules }: { id: string; nom: string; site: Site; rules: RuleParams }) {
  const { state, dispatch } = useEditor()
  const { status, saveNow, lastError } = useAutosave({ projectId: id, state, dispatch })
  const [aide, setAide] = useState(false)
  useShortcuts(dispatch, state, { saveNow, openHelp: () => setAide(true) })
  const catalogue = useCatalog()
  const violations = useMemo(() => validatePlan(site, rules, state.plan), [state.plan, site, rules])
  return (
    <div className={styles.page}>
      <header className={styles.entete}>
        <h1 className={styles.titre}>{nom}</h1>
        <Link to={`/projets/${id}/parametres`}>Paramètres du projet</Link>
        <div className={styles.sauvegarde}><SaveStatus status={status} saveNow={saveNow} lastError={lastError} /></div>
        <LeaveGuard dirty={isDirty(state)} saving={status === 'saving'} saveNow={saveNow} />
      </header>
      <p className={styles.etroit}>L'éditeur est prévu pour un écran d'ordinateur.</p>
      <div className={styles.zones}>
        <Toolbar onHelp={() => setAide(true)} />
        <div className={styles.centre}>
          <LevelTabs />
          <div className={styles.canvas}>
            <PlanCanvas site={site} rules={rules} violations={violations} catalogue={catalogue.data} />
          </div>
        </div>
        <aside className={styles.panneaux} aria-label="Panneaux">
          <CatalogPalette />
          <PropertiesPanel />
          <RulesPanel violations={violations} />
        </aside>
      </div>
      <ShortcutsDialog open={aide} onClose={() => setAide(false)} />
    </div>
  )
}
