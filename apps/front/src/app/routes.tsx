import type { RouteObject } from 'react-router'
import { EditorPage } from '../features/editor/EditorPage'
import { AccountPage } from '../pages/AccountPage'
import { AdminCatalogPage } from '../pages/AdminCatalogPage'
import { DashboardPage } from '../pages/DashboardPage'
import { DesignSystemPage } from '../pages/DesignSystemPage'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'
import { NewProjectPage } from '../pages/NewProjectPage'
import { ProjectSettingsPage } from '../pages/ProjectSettingsPage'
import { RegisterPage } from '../pages/RegisterPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { AppShell } from './AppShell'
import { NotFoundPage } from './NotFoundPage'
import { RequireAdmin } from './RequireAdmin'
import { RequireAuth } from './RequireAuth'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/design-system', element: <DesignSystemPage /> },
      { path: '/connexion', element: <LoginPage /> },
      { path: '/inscription', element: <RegisterPage /> },
      { path: '/mot-de-passe-oublie', element: <ForgotPasswordPage /> },
      { path: '/mot-de-passe/reinitialiser', element: <ResetPasswordPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/projets', element: <DashboardPage /> },
          { path: '/projets/nouveau', element: <NewProjectPage /> },
          { path: '/projets/:id', element: <EditorPage /> },
          { path: '/projets/:id/parametres', element: <ProjectSettingsPage /> },
          { path: '/compte', element: <AccountPage /> },
          {
            element: <RequireAdmin />,
            children: [{ path: '/admin/catalogue', element: <AdminCatalogPage /> }],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
