import type { ReactNode } from 'react'
import styles from './ToolButton.module.css'

type Props = { label: string; active?: boolean; icon: ReactNode; onClick?: () => void }

export function ToolButton({ label, active = false, icon, onClick }: Props) {
  return (
    <button
      type="button"
      className={`${styles.tool} ${active ? styles.on : ''}`}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
