import { Link, Outlet } from 'react-router'
import { useMe } from '../lib/auth'
import { PageHeader } from '../ui'

export function RequireAdmin() {
  const me = useMe()
  if (me.data?.role !== 'admin') {
    return (
      <div>
        <PageHeader title="Accès réservé aux administrateurs." />
        <Link to="/projets">Retour au tableau de bord</Link>
      </div>
    )
  }
  return <Outlet />
}
