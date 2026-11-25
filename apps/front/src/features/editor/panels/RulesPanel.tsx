import type { Violation } from '@digimmo/domain'
import { RuleBadge } from '../../../ui'
import { currentLevel } from '../state/reducer'
import type { Selection } from '../state/types'
import { useEditor } from '../state/useEditor'
import styles from './RulesPanel.module.css'

const pluriel = (n: number, un: string) => `${n} ${un}${n > 1 ? 's' : ''}`

export function RulesPanel({ violations }: { violations: Violation[] }) {
  const { state, dispatch } = useEditor()
  const erreurs = violations.filter((v) => v.severity === 'error')
  const alertes = violations.filter((v) => v.severity !== 'error')
  const tri = [...erreurs, ...alertes]
  const compte = [erreurs.length > 0 && pluriel(erreurs.length, 'erreur'), alertes.length > 0 && pluriel(alertes.length, 'alerte')].filter(Boolean).join(', ')

  const aller = (v: Violation) => {
    const levelId = v.level ?? state.levelId
    const level = state.plan.levels.find((l) => l.id === levelId) ?? currentLevel(state)
    let selection: Selection = null
    for (const ref of v.refs) {
      if (level.rooms.some((r) => r.id === ref)) selection = { kind: 'room', id: ref }
      else if (level.openings.some((o) => o.id === ref)) selection = { kind: 'opening', id: ref }
      else if (level.furniture.some((f) => f.id === ref)) selection = { kind: 'furniture', id: ref }
      else if (ref === 'stairs') selection = { kind: 'stairs', id: 'stairs' }
      if (selection) break
    }
    if (!selection) return
    if (level.id !== state.levelId) dispatch({ type: 'setLevel', levelId: level.id })
    dispatch({ type: 'select', selection })
  }

  return (
    <section aria-labelledby="ed-regles">
      <h2 id="ed-regles">{compte ? `Règles (${compte})` : 'Règles'}</h2>
      {tri.length === 0 ? (
        <p>Aucun problème détecté</p>
      ) : (
        <ul className={styles.liste}>
          {tri.map((v, i) => (
            <li key={`${v.code}-${i}`}>
              {v.refs.length > 0 ? (
                <button type="button" className={styles.ligne} onClick={() => aller(v)}>
                  <RuleBadge severity={v.severity}>{v.message}</RuleBadge>
                </button>
              ) : (
                <RuleBadge severity={v.severity}>{v.message}</RuleBadge>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
