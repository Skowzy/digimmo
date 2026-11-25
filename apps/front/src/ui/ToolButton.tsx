import type { ReactNode } from 'react'
import styles from './ToolButton.module.css'

type Props = { label: string; active?: boolean; icon: ReactNode; onClick?: () => void; disabled?: boolean }

export function ToolButton({ label, active = false, icon, onClick, disabled = false }: Props) {
  return (
    <button
      type="button"
      className={`${styles.tool} ${active ? styles.on : ''}`}
      aria-pressed={active}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
