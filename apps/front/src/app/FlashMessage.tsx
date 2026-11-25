import { useLocation } from 'react-router'
import { Alert } from '../ui'

export function FlashMessage() {
  const flash = (useLocation().state as { flash?: unknown } | null)?.flash
  return typeof flash === 'string' ? <Alert tone="success">{flash}</Alert> : null
}
