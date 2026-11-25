import type { ApiError } from '../../../lib/api'
import { Button } from '../../../ui'
import type { SaveStatusKind } from '../save/useAutosave'

const TEXTES: Record<SaveStatusKind, string> = {
  saved: 'Enregistré',
  dirty: 'Modifications non enregistrées',
  saving: 'Enregistrement…',
  error: "Échec de l'enregistrement",
}

type Props = { status: SaveStatusKind; saveNow: () => unknown; lastError?: ApiError }

function detail(e: ApiError): string[] {
  if (e.status === 404) return ["Ce projet n'existe plus."]
  if (e.status === 400 && e.issues.length > 0) return e.issues
  return [e.message]
}

export function SaveStatus({ status, saveNow, lastError }: Props) {
  return (
    <div>
      <div role="status">
        {TEXTES[status]}
        {status === 'error' && lastError && (
          <ul>{detail(lastError).map((m) => <li key={m}>{m}</li>)}</ul>
        )}
      </div>
      {status === 'error' && <Button size="sm" variant="secondary" onClick={() => void saveNow()}>Réessayer</Button>}
      <Button size="sm" disabled={status === 'saved'} loading={status === 'saving'} onClick={() => void saveNow()}>Enregistrer</Button>
    </div>
  )
}
