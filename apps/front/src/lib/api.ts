export class ApiError extends Error {
  status: number
  issues: string[]
  constructor(message: string, status: number, issues: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.issues = issues
  }
}

type Init = { method?: string; body?: unknown }

let onUnauthorized: (() => void) | null = null

/** Enregistre le callback appelé sur un 401 hors routes d'authentification. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

const ROUTES_AUTH_PUBLIQUES = new Set(['GET /auth/me', 'POST /auth/login', 'POST /auth/register'])

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const method = init.method ?? 'GET'
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApiError('Erreur réseau. Vérifiez votre connexion.', 0)
  }

  if (response.status === 204) return undefined as T

  let data: unknown
  try {
    data = await response.json()
  } catch {
    if (response.ok) throw new ApiError('Erreur inattendue.', response.status)
    data = undefined
  }

  if (response.status >= 400) {
    if (response.status === 401 && !ROUTES_AUTH_PUBLIQUES.has(`${method} ${path.split('?')[0]}`)) {
      onUnauthorized?.()
    }
    const body = (data ?? {}) as { message?: unknown; issues?: unknown }
    throw new ApiError(
      typeof body.message === 'string' ? body.message : 'Erreur inattendue.',
      response.status,
      Array.isArray(body.issues) ? body.issues.map(String) : [],
    )
  }
  return data as T
}

/** Message de la première issue du champ (format serveur « chemin: message »). */
export function issuesFor(issues: string[], field: string): string | undefined {
  const prefixe = `${field}: `
  const issue = issues.find((i) => i.startsWith(prefixe))
  return issue?.slice(prefixe.length)
}
