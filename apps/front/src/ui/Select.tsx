import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import styles from './Select.module.css'

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: { value: string; label: string }[]
  error?: string
  hint?: string
}

export function Select({ label, options, error, hint, id, className, ...select }: Props) {
  const generated = useId()
  const sid = id ?? generated
  const describedBy = [error && `${sid}-erreur`, hint && `${sid}-aide`].filter(Boolean).join(' ')
  return (
    <div className={`${styles.field} ${error ? styles.err : ''}`}>
      <label htmlFor={sid}>{label}</label>
      <select
        {...select}
        id={sid}
        className={className}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <small id={`${sid}-aide`} className={styles.hint}>{hint}</small>}
      {error && <small id={`${sid}-erreur`} className={styles.error}>{error}</small>}
    </div>
  )
}
