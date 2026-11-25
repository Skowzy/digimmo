import { Button, ToolButton } from '../../../ui'
import type { Tool } from '../state/types'
import { useEditor } from '../state/useEditor'
import styles from '../EditorPage.module.css'

const OUTILS: { tool: Tool; label: string; icon: string }[] = [
  { tool: 'select', label: 'Sélection (V)', icon: '↖' },
  { tool: 'room', label: 'Pièce (P)', icon: '▭' },
  { tool: 'door', label: 'Porte (D)', icon: '◐' },
  { tool: 'window', label: 'Fenêtre (F)', icon: '▦' },
  { tool: 'furniture', label: 'Meuble (M)', icon: '▤' },
  { tool: 'stairs', label: 'Escalier (E)', icon: '≡' },
]

export function Toolbar({ onHelp }: { onHelp?: () => void }) {
  const { state, dispatch } = useEditor()
  const aEtage = state.plan.levels.some((l) => l.id === 'r1')
  return (
    <div className={styles.outils} role="toolbar" aria-label="Outils">
      {OUTILS.map((o) => (
        <ToolButton
          key={o.tool}
          label={o.label}
          icon={o.icon}
          active={state.tool === o.tool}
          disabled={o.tool === 'stairs' && !aEtage}
          onClick={() => dispatch({ type: 'setTool', tool: o.tool })}
        />
      ))}
      <ToolButton label="Annuler" icon="↶" disabled={state.past.length === 0} onClick={() => dispatch({ type: 'undo' })} />
      <ToolButton label="Rétablir" icon="↷" disabled={state.future.length === 0} onClick={() => dispatch({ type: 'redo' })} />
      <Button variant="secondary" size="sm" aria-label="Raccourcis clavier (?)" title="Raccourcis clavier (?)" onClick={onHelp}>?</Button>
    </div>
  )
}
