import type { QueryClient } from '@tanstack/react-query'
import type { createBrowserRouter } from 'react-router'

type Router = Pick<ReturnType<typeof createBrowserRouter>, 'navigate' | 'state'>

/** Session expirée : vide le cache puis renvoie vers la connexion (une seule fois). */
export function createUnauthorizedHandler(queryClient: QueryClient, router: Router) {
  return () => {
    const { pathname, search } = router.state.location
    if (pathname === '/connexion') return
    queryClient.clear()
    void router.navigate(`/connexion?suite=${encodeURIComponent(pathname + search)}`, { replace: true })
  }
}
