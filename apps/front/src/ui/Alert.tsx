import type { ReactNode, Ref } from 'react'
import styles from './Alert.module.css'

type Props = { tone?: 'error' | 'warning' | 'info' | 'success'; title?: string; children: ReactNode; ref?: Ref<HTMLDivElement>; tabIndex?: number }

export function Alert({ tone = 'error', title, children, ref, tabIndex }: Props) {
  return (
    <div ref={ref} tabIndex={tabIndex} role={tone === 'error' ? 'alert' : 'status'} className={`${styles.alert} ${styles[tone]}`}>
      {title && <strong className={styles.title}>{title}</strong>}
      <div>{children}</div>
    </div>
  )
}
