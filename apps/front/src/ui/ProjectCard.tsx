import { Link } from 'react-router'
import { formatArea } from '@digimmo/domain'
import type { Plan, Violation } from '@digimmo/domain'
import { modifieIlYa } from '../lib/dates'
import { polygonArea } from '../lib/geometry'
import type { ProjectDto } from '../lib/queries'
import { Button } from './Button'
import { PlanThumbnail } from './PlanThumbnail'
import { RuleBadge } from './RuleBadge'
import styles from './ProjectCard.module.css'

type Props = { project: ProjectDto; plan?: Plan; violations?: Violation[]; onDelete?: () => void }

function pastille(violations: Violation[]) {
  if (violations.some((v) => v.code === 'TOO_MANY_VIOLATIONS')) return <RuleBadge severity="error">200+ erreurs</RuleBadge>
  const erreurs = violations.filter((v) => v.severity === 'error').length
  const alertes = violations.filter((v) => v.severity === 'warning').length
  if (erreurs > 0) return <RuleBadge severity="error">{erreurs} {erreurs > 1 ? 'erreurs' : 'erreur'}</RuleBadge>
  if (alertes > 0) return <RuleBadge severity="warning">{alertes} {alertes > 1 ? 'alertes' : 'alerte'}</RuleBadge>
  return <RuleBadge severity="ok">Valide</RuleBadge>
}

export function ProjectCard({ project, plan, violations, onDelete }: Props) {
  const terrain = formatArea(polygonArea(project.site.boundary))
  const maison = formatArea(
    (plan?.levels.find((l) => l.id === 'rdc')?.rooms ?? []).reduce((s, r) => s + r.rect.w * r.rect.h, 0),
  )
  return (
    <article className={styles.card}>
      <PlanThumbnail site={project.site} plan={plan} />
      <h2 className={styles.name}>
        <Link to={`/projets/${project.id}`}>{project.name}</Link>
      </h2>
      <p className={styles.mono}>Terrain {terrain} · Maison {maison}</p>
      <div className={styles.badge}>{violations && pastille(violations)}</div>
      <div className={styles.footer}>
        <span className={styles.date}>{modifieIlYa(project.updatedAt)}</span>
        {onDelete && <Button variant="danger" size="sm" onClick={onDelete}>Supprimer</Button>}
      </div>
    </article>
  )
}
