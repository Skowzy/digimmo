import { useEffect, useRef, useState } from 'react'
import { FlashMessage } from '../app/FlashMessage'
import { ProjectSettingsForm } from '../features/projects/ProjectSettingsForm'
import type { ProjectSettingsValues } from '../features/projects/valeursParDefaut'
import { ApiError } from '../lib/api'
import { useProject, usePlan, useUpdateProject } from '../lib/queries'
import { siteToTerrain } from '../lib/units'
import { Alert, ButtonLink, PageHeader, RuleBadge } from '../ui'
import { useParams } from 'react-router'
import type { Violation } from '@digimmo/domain'
import styles from './ProjectPage.module.css'
import { useTitrePage } from '../app/useTitrePage'

function rang(v: Violation) {
  if (v.severity === 'error') return 0
  return v.code === 'TOO_MANY_VIOLATIONS' ? 2 : 1
}
const trier = (vs: Violation[]) => [...vs].sort((a, b) => rang(a) - rang(b))

export function ProjectPage() {
  const { id = '' } = useParams()
  const projet = useProject(id)
  useTitrePage(projet.data?.name ?? 'Projet')
  const plan = usePlan(id)
  const update = useUpdateProject(id)
  const [enregistre, setEnregistre] = useState(false)
  const succesRef = useRef<HTMLDivElement>(null)
  const misAJour = projet.data?.updatedAt

  // Le formulaire est remonté après l'enregistrement (clé `updatedAt`) : le focus revient donc
  // sur le message de succès, qui est ainsi annoncé.
  useEffect(() => {
    if (enregistre) succesRef.current?.focus()
  }, [enregistre, misAJour])

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
  if (!projet.data) return <div><PageHeader title="Projet" /><p>Chargement…</p></div>

  const p = projet.data
  const terrain = siteToTerrain(p.site)
  const initial: ProjectSettingsValues = { name: p.name, terrain, rules: p.rules }
  const violations = plan.data ? trier(plan.data.validation.violations) : null

  return (
    <div>
      <FlashMessage />
      <PageHeader title={p.name} />
      {projet.isError && <Alert tone="warning">Impossible d'actualiser le projet.</Alert>}
      <div className={styles.bientot}><p>L'éditeur arrive bientôt</p></div>
      <section className={styles.section} aria-labelledby="violations">
        <h2 id="violations">Contrôle du plan</h2>
        {plan.isError && <Alert>{plan.error.message}</Alert>}
        {violations && violations.length === 0 && <p>Aucun problème détecté</p>}
        {violations && violations.length > 0 && (
          <ul className={styles.liste}>
            {violations.map((v, i) => (
              <li key={`${v.code}-${i}`}><RuleBadge severity={v.severity}>{v.message}</RuleBadge></li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.section} aria-labelledby="parametres">
        <h2 id="parametres">Paramètres du projet</h2>
        {enregistre && <Alert tone="success" ref={succesRef} tabIndex={-1}>Paramètres enregistrés.</Alert>}
        <ProjectSettingsForm
          key={p.updatedAt}
          initial={initial}
          terrainFige={terrain === null}
          submitLabel="Enregistrer"
          pending={update.isPending}
          serverError={update.error}
          onSubmit={(values) => {
            setEnregistre(false)
            return update.mutateAsync(values).then(() => setEnregistre(true), () => undefined)
          }}
        />
      </section>
    </div>
  )
}
