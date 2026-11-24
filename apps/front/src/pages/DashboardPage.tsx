import { FlashMessage } from '../app/FlashMessage'
import { PageHeader } from '../ui'

export function DashboardPage() {
  return (
    <div>
      <FlashMessage />
      <PageHeader title="Mes projets" />
    </div>
  )
}
