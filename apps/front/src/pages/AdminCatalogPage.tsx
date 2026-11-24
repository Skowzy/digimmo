import { FlashMessage } from '../app/FlashMessage'
import { PageHeader } from '../ui'

export function AdminCatalogPage() {
  return (
    <div>
      <FlashMessage />
      <PageHeader title="Catalogue" />
    </div>
  )
}
