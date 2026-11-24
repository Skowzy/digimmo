import type { RouteObject } from 'react-router'
import { HomePage } from './HomePage'
import { NotFoundPage } from './NotFoundPage'
import { DesignSystemPage } from '../pages/DesignSystemPage'

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/design-system', element: <DesignSystemPage /> },
  { path: '*', element: <NotFoundPage /> },
]
