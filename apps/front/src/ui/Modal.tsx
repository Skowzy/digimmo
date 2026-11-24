import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import styles from './Modal.module.css'

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }

export function Modal({ open, title, onClose, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const openRef = useRef(open)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    openRef.current = open
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) {
        trigger.current = document.activeElement as HTMLElement | null
        dialog.showModal()
      }
    } else {
      dialog.close()
      trigger.current?.focus()
      trigger.current = null
    }
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      onCloseRef.current()
    }
    const onNativeClose = () => {
      if (openRef.current) onCloseRef.current()
    }
    dialog.addEventListener('cancel', onCancel)
    dialog.addEventListener('close', onNativeClose)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.removeEventListener('close', onNativeClose)
    }
  }, [])

  return (
    <dialog ref={ref} className={styles.modal} aria-labelledby={titleId}>
      {open && (
        <>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <div>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </>
      )}
    </dialog>
  )
}
