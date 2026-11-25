import { useEffect, useRef, useState } from 'react'
import type { LevelId } from '@digimmo/domain'
import { Button, Modal } from '../../../ui'
import { useEditor } from '../state/useEditor'
import styles from './LevelTabs.module.css'

const ONGLETS: { id: LevelId; label: string }[] = [
  { id: 'rdc', label: 'Rez-de-chaussée' },
  { id: 'r1', label: 'Étage' },
]

export function LevelTabs() {
  const { state, dispatch } = useEditor()
  const aEtage = state.plan.levels.some((l) => l.id === 'r1')
  const [confirmer, setConfirmer] = useState(false)
  const refs = useRef<Partial<Record<LevelId, HTMLButtonElement | null>>>({})
  const focusEtage = useRef(false)
  const focusAjout = useRef(false)
  const boutonAjout = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (aEtage && focusEtage.current) { focusEtage.current = false; refs.current.r1?.focus() }
    if (!aEtage && focusAjout.current) { focusAjout.current = false; boutonAjout.current?.querySelector('button')?.focus() }
  }, [aEtage])

  const ajouter = () => { focusEtage.current = true; dispatch({ type: 'addUpperLevel' }) }
  const retirer = () => {
    setConfirmer(false)
    focusAjout.current = true
    dispatch({ type: 'removeUpperLevel' })
    if (state.tool === 'stairs') dispatch({ type: 'setTool', tool: 'select' })
  }
  const aller = (id: LevelId) => { dispatch({ type: 'setLevel', levelId: id }); refs.current[id]?.focus() }

  if (!aEtage) {
    return <div ref={boutonAjout} className={styles.niveaux}><Button variant="secondary" size="sm" onClick={ajouter}>+ Étage</Button></div>
  }
  return (
    <div className={styles.niveaux}>
      <div role="tablist" aria-label="Niveaux" className={styles.onglets}>
        {ONGLETS.map((o, i) => {
          const actif = state.levelId === o.id
          return (
            <button
              key={o.id}
              ref={(el) => { refs.current[o.id] = el }}
              type="button"
              role="tab"
              aria-selected={actif}
              tabIndex={actif ? 0 : -1}
              className={`${styles.onglet} ${actif ? styles.actif : ''}`}
              onClick={() => dispatch({ type: 'setLevel', levelId: o.id })}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                aller(ONGLETS[(i + (e.key === 'ArrowRight' ? 1 : ONGLETS.length - 1)) % ONGLETS.length]!.id)
              }}
            >{o.label}</button>
          )
        })}
      </div>
      <Button variant="danger" size="sm" onClick={() => setConfirmer(true)}>Retirer l'étage</Button>
      <Modal
        open={confirmer}
        title="Retirer l'étage ?"
        onClose={() => setConfirmer(false)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirmer(false)}>Annuler</Button>
            <Button variant="danger" onClick={retirer}>Retirer l'étage</Button>
          </>
        )}
      >
        <p>Ses pièces, ses ouvertures, ses meubles et l'escalier seront supprimés.</p>
      </Modal>
    </div>
  )
}
