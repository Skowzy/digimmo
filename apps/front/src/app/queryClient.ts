import { QueryClient } from '@tanstack/react-query'
import type { QueryObserverOptions } from '@tanstack/react-query'
import { ApiError } from '../lib/api'

/** Pas de nouvel essai sur une erreur client (4xx) ; deux essais au plus sinon. */
export const retryPolicy = (failureCount: number, error: unknown) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2

export function createQueryClient(overrides: Partial<QueryObserverOptions> = {}) {
  return new QueryClient({ defaultOptions: { queries: { retry: retryPolicy, ...overrides } } })
}
