import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './app/routes'
import { createUnauthorizedHandler } from './app/unauthorized'
import { setUnauthorizedHandler } from './lib/api'
import './styles/global.css'

const router = createBrowserRouter(routes)
const queryClient = new QueryClient()
setUnauthorizedHandler(createUnauthorizedHandler(queryClient, router))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
