import { FlashMessage } from '../app/FlashMessage'
import { PageHeader } from '../ui'

export function AccountPage() {
  return (
    <div>
      <FlashMessage />
      <PageHeader title="Mon compte" />
    </div>
  )
}
