import { useEffect } from 'react'

/** Titre du document : « <titre> · Digimmo » ; sans titre, « Digimmo ». */
export function useTitrePage(titre?: string) {
  useEffect(() => {
    document.title = titre ? `${titre} · Digimmo` : 'Digimmo'
  }, [titre])
}
