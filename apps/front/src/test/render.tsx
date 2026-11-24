import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryObserverOptions } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createQueryClient } from '../app/queryClient'
import { routes } from '../app/routes'
import { createUnauthorizedHandler } from '../app/unauthorized'
import { setUnauthorizedHandler } from '../lib/api'

export function renderApp(path: string, queryOptions: Partial<QueryObserverOptions> = { retry: false }) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = createQueryClient(queryOptions)
  setUnauthorizedHandler(createUnauthorizedHandler(queryClient, router))
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...result, router, queryClient }
}
