import { Link } from 'react-router'
import { PageHeader } from '../ui'
import { useTitrePage } from './useTitrePage'

export function NotFoundPage() {
  useTitrePage('Page introuvable')
  return (
    <div>
      <PageHeader title="Page introuvable" />
      <Link to="/">Retour à l'accueil</Link>
    </div>
  )
}
