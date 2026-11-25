import { useRef } from 'react'

/** Verrou synchrone (ref) : `isPending` n'est mis à jour qu'au rendu, deux envois dans le même tick passeraient. */
export function useEnvoiUnique() {
  const enCours = useRef(false)
  return {
    occupe: () => enCours.current,
    prendre: () => {
      enCours.current = true
    },
    liberer: () => {
      enCours.current = false
    },
  }
}
