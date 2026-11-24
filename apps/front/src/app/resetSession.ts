import type { QueryClient } from '@tanstack/react-query'

/** Réinitialise la session : `['me']` passe à `null` (les observateurs sont notifiés), le reste du cache est retiré. */
export function resetSession(queryClient: QueryClient) {
  queryClient.setQueryData(['me'], null)
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
}
