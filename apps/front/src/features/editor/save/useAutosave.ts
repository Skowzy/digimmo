import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Plan, Violation } from '@digimmo/domain'
import { api, ApiError } from '../../../lib/api'
import type { Action } from '../state/reducer'
import { isDirty } from '../state/reducer'
import type { EditorState } from '../state/types'

export type SaveStatusKind = 'saved' | 'dirty' | 'saving' | 'error'

export interface Autosave {
  status: SaveStatusKind
  /** Enregistre tout de suite ; résolu à `true` si le plan est enregistré, `false` en cas d'échec. */
  saveNow(): Promise<boolean>
  lastError?: ApiError
}

const RETRY_MS = 10_000
const json = (plan: Plan) => JSON.stringify(plan)
const retryable = (e: ApiError) => e.status === 0 || e.status >= 500

interface Options {
  projectId: string
  state: EditorState
  dispatch: Dispatch<Action>
  delayMs?: number
}

/**
 * Sauvegarde du plan : une seule requête à la fois, délai relancé à chaque modification,
 * nouvel essai après 10 s sur erreur réseau / 5xx. Le plan envoyé est marqué enregistré ;
 * s'il a changé entre-temps, il reste modifié et un nouvel envoi est programmé.
 */
export function useAutosave({ projectId, state, dispatch, delayMs = 3000 }: Options): Autosave {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  // L'erreur est liée au plan envoyé : elle disparaît si l'on revient à un autre plan (undo vers l'enregistré).
  const [error, setError] = useState<{ err: ApiError; planJson: string } | null>(null)

  const planRef = useRef(state.plan)
  const savedRef = useRef(json(state.savedPlan)) // dernier plan connu du serveur
  const alive = useRef(true)
  const running = useRef<Promise<boolean> | null>(null) // l'unique requête en vol
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const retryFn = useRef<() => void>(() => {})

  useEffect(() => { planRef.current = state.plan })

  const clearTimers = () => { clearTimeout(timer.current); clearTimeout(retry.current) }

  const send = useCallback((): Promise<boolean> => {
    if (running.current) return running.current
    const plan = planRef.current
    if (json(plan) === savedRef.current) return Promise.resolve(true)
    clearTimers()
    setSaving(true)
    setError(null)
    const run = (async () => {
      try {
        const res = await api<{ validation: { violations: Violation[]; checkedAt: string } }>(
          `/projects/${projectId}/plan`, { method: 'PUT', body: plan },
        )
        savedRef.current = json(plan)
        // Le serveur détient ce plan : le cache doit le refléter même si l'éditeur est démonté.
        queryClient.setQueryData(['projects', projectId, 'plan'], { plan, validation: res.validation })
        if (!alive.current) return true // démonté : ni dispatch ni setState ni nouvel essai
        dispatch({ type: 'markSaved', plan })
        return true
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError('Erreur inattendue.', 0)
        if (!alive.current) return false
        setError({ err, planJson: json(plan) })
        if (retryable(err)) retry.current = setTimeout(() => retryFn.current(), RETRY_MS)
        return false
      } finally {
        running.current = null
        if (alive.current) setSaving(false)
      }
    })()
    running.current = run
    return run
  }, [projectId, queryClient, dispatch])

  useEffect(() => { retryFn.current = () => { void send() } }, [send])

  const saveNow = useCallback(async () => {
    clearTimers()
    while (running.current) await running.current
    return send()
  }, [send])

  // Délai de 3 s relancé à chaque modification ; reprogrammé après chaque envoi si le plan a encore changé.
  const dirty = isDirty(state)
  useEffect(() => {
    clearTimeout(timer.current)
    if (!dirty) return
    timer.current = setTimeout(() => { if (!running.current) void send() }, delayMs)
    return () => clearTimeout(timer.current)
  }, [state.plan, state.savedPlan, dirty, delayMs, send])

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; clearTimers() }
  }, [])

  const erreur = dirty && error && error.planJson === json(state.plan) ? error.err : undefined
  const status: SaveStatusKind = saving ? 'saving' : erreur ? 'error' : dirty ? 'dirty' : 'saved'
  return { status, saveNow, lastError: erreur }
}
