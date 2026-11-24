import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import styles from './Field.module.css'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
  mono?: boolean
}

export function Field({ label, error, hint, id, mono = false, className, ...input }: Props) {
  const generated = useId()
  const fid = id ?? generated
  const describedBy = [error && `${fid}-erreur`, hint && `${fid}-aide`].filter(Boolean).join(' ')
  return (
    <div className={`${styles.field} ${error ? styles.err : ''}`}>
      <label htmlFor={fid}>{label}</label>
      <input
        {...input}
        id={fid}
        className={`${mono ? styles.mono : ''} ${className ?? ''}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {hint && <small id={`${fid}-aide`} className={styles.hint}>{hint}</small>}
      {error && <small id={`${fid}-erreur`} className={styles.error}>{error}</small>}
    </div>
  )
}
