import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from '../lib/auth'

export function RequireAuth() {
  const me = useMe()
  const { pathname, search } = useLocation()
  if (me.isPending) return <p role="status">Chargement…</p>
  if (!me.data) {
    return <Navigate to={`/connexion?suite=${encodeURIComponent(pathname + search)}`} replace />
  }
  return <Outlet />
}
