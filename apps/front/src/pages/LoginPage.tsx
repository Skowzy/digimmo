import { FlashMessage } from '../app/FlashMessage'
import { PageHeader } from '../ui'

export function LoginPage() {
  return (
    <div>
      <FlashMessage />
      <PageHeader title="Connexion" />
    </div>
  )
}
