import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div>
      <h1>Page introuvable</h1>
      <Link to="/">Retour à l'accueil</Link>
    </div>
  )
}
