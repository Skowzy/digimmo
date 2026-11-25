import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  className,
  disabled,
  ...button
}: Props) {
  const classes = [styles.btn, `btn btn--${variant} btn--${size}`, styles[variant], styles[size], className]
  return (
    <button
      {...button}
      type={type}
      className={classes.filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    />
  )
}
