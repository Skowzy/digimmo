import { FlashMessage } from '../app/FlashMessage'
import { PageHeader } from '../ui'

export function RegisterPage() {
  return (
    <div>
      <FlashMessage />
      <PageHeader title="Créer un compte" />
    </div>
  )
}
