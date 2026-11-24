import { FlashMessage } from '../app/FlashMessage'
import { PageHeader } from '../ui'

export function NewProjectPage() {
  return (
    <div>
      <FlashMessage />
      <PageHeader title="Nouveau projet" />
    </div>
  )
}
