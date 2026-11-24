import { Link } from 'react-router'
import type { LinkProps } from 'react-router'
import styles from './Button.module.css'

type Props = LinkProps & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm' }

/** Navigation présentée comme un bouton (même apparence que `Button`). */
export function ButtonLink({ variant = 'primary', size = 'md', className, ...link }: Props) {
  const classes = [styles.btn, `btn btn--${variant} btn--${size}`, styles[variant], styles[size], styles.lien, className]
  return <Link {...link} className={classes.filter(Boolean).join(' ')} />
}
