import type { ReactNode, Ref } from 'react'
import styles from './PageHeader.module.css'

type Props = { title: string; subtitle?: string; actions?: ReactNode; titleRef?: Ref<HTMLHeadingElement> }

export function PageHeader({ title, subtitle, actions, titleRef }: Props) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title} ref={titleRef} tabIndex={titleRef ? -1 : undefined}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
