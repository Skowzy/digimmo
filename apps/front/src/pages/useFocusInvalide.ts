import { useEffect, useRef } from 'react'

/** Après un envoi refusé (`tentative` incrémenté), focalise le premier champ invalide du formulaire. */
export function useFocusInvalide(tentative: number) {
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (tentative > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [tentative])
  return formRef
}
