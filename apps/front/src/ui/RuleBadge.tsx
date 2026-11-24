import type { ReactNode } from 'react'
import styles from './RuleBadge.module.css'

const META = {
  ok: { icon: '✓', label: 'Valide' },
  warning: { icon: '!', label: 'Alerte' },
  error: { icon: '✗', label: 'Erreur' },
} as const

export function RuleBadge({ severity, children }: { severity: keyof typeof META; children: ReactNode }) {
  const { icon, label } = META[severity]
  return (
    <span className={`badge badge--${severity} ${styles.badge} ${styles[severity]}`}>
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">{label} : </span>
      {children}
    </span>
  )
}
