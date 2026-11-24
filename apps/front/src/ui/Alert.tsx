import type { ReactNode } from 'react'
import styles from './Alert.module.css'

type Props = { tone?: 'error' | 'warning' | 'info' | 'success'; title?: string; children: ReactNode }

export function Alert({ tone = 'error', title, children }: Props) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`${styles.alert} ${styles[tone]}`}>
      {title && <strong className={styles.title}>{title}</strong>}
      <div>{children}</div>
    </div>
  )
}
