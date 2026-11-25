import { useEffect, useRef, useState } from 'react'
import { formatArea, formatMeters, type Room, type RoomType } from '@digimmo/domain'
import { parseMeters, parseMetersOrZero } from '../../../lib/units'
import { Button, Field, Select } from '../../../ui'
import { currentLevel } from '../state/reducer'
import { useEditor } from '../state/useEditor'
import styles from './PropertiesPanel.module.css'

const TYPES: { value: RoomType; label: string }[] = [
  { value: 'sejour', label: 'Séjour' },
  { value: 'cuisine', label: 'Cuisine' },
  { value: 'chambre', label: 'Chambre' },
  { value: 'sdb', label: 'Salle de bain' },
  { value: 'wc', label: 'WC' },
  { value: 'entree', label: 'Entrée' },
  { value: 'degagement', label: 'Dégagement' },
  { value: 'garage', label: 'Garage' },
  { value: 'autre', label: 'Autre' },
]

const MAX = 100_000
const metres = (cm: number) => (cm / 100).toFixed(2).replace('.', ',')

type Analyse = { ok: true; value: string | number } | { ok: false; error: string }

/** Champ contrôlé localement : validé à la perte de focus ou sur Entrée, Échap restaure. */
function Champ({ label, committed, parse, onCommit, mono }: {
  label: string
  committed: string
  parse: (texte: string) => Analyse
  onCommit: (value: string | number) => void
  mono?: boolean
}) {
  const [texte, setTexte] = useState(committed)
  const [erreur, setErreur] = useState<string>()
  const edition = useRef(false)

  // Resynchronise (annuler, glisser sur le plan…) sauf pendant la saisie.
  useEffect(() => {
    if (!edition.current) {
      setTexte(committed)
      setErreur(undefined)
    }
  }, [committed])

  const valider = () => {
    const r = parse(texte)
    if (!r.ok) { setErreur(r.error); return }
    setErreur(undefined)
    onCommit(r.value)
    setTexte(typeof r.value === 'number' ? metres(r.value) : r.value)
  }

  return (
    <Field
      label={label}
      mono={mono}
      value={texte}
      error={erreur}
      onFocus={() => { edition.current = true }}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={() => { edition.current = false; valider() }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); valider() }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setTexte(committed); setErreur(undefined) }
      }}
    />
  )
}

const bornes = (min: number): string => `Valeur entre ${formatMeters(min)} et ${formatMeters(MAX)}`
const analyseMetres = (min: number, zero: boolean) => (texte: string): Analyse => {
  const cm = (zero ? parseMetersOrZero : parseMeters)(texte)
  return cm === null || cm < min || cm > MAX ? { ok: false, error: bornes(min) } : { ok: true, value: cm }
}
const analyseNom = (texte: string): Analyse => {
  const nom = texte.trim()
  return nom.length < 1 || nom.length > 60 ? { ok: false, error: 'Le nom doit faire entre 1 et 60 caractères.' } : { ok: true, value: nom }
}

export function PropertiesPanel() {
  const { state } = useEditor()
  const sel = state.selection
  const level = currentLevel(state)
  const room = sel?.kind === 'room' ? level.rooms.find((r) => r.id === sel.id) : undefined
  let titre: string | undefined
  if (sel?.kind === 'opening') {
    const o = level.openings.find((x) => x.id === sel.id)
    if (o) titre = o.kind === 'door' ? 'Porte' : 'Fenêtre'
  } else if (sel?.kind === 'furniture') {
    const f = level.furniture.find((x) => x.id === sel.id)
    if (f) titre = `Meuble : ${f.label}`
  } else if (sel?.kind === 'stairs' && state.plan.stairs) titre = 'Escalier'
  return (
    <section aria-labelledby="ed-proprietes" className={styles.panneau}>
      <h2 id="ed-proprietes">Propriétés</h2>
      {room ? <PanneauPiece key={room.id} room={room} />
        : titre ? <PanneauElement titre={titre} />
          : <p>Sélectionnez un élément du plan.</p>}
    </section>
  )
}

function supprimerEtFocaliser(dispatch: ReturnType<typeof useEditor>['dispatch']) {
  dispatch({ type: 'deleteSelection' })
  document.querySelector<SVGSVGElement>('svg[aria-label="Plan du projet"]')?.focus()
}

/** Ouverture, meuble ou escalier : seule la suppression pour l'instant (les tâches 7 à 9 ajoutent leurs champs). */
function PanneauElement({ titre }: { titre: string }) {
  const { dispatch } = useEditor()
  return (
    <div className={styles.champs}>
      <h3 className={styles.titreElement}>{titre}</h3>
      <Button variant="danger" size="sm" onClick={() => supprimerEtFocaliser(dispatch)}>Supprimer</Button>
    </div>
  )
}

function PanneauPiece({ room }: { room: Room }) {
  const { dispatch } = useEditor()
  const { x, y, w, h } = room.rect
  const modifier = (changes: Partial<Omit<Room, 'id'>>) => dispatch({ type: 'updateRoom', id: room.id, changes })
  const rect = (changes: Partial<Room['rect']>) => modifier({ rect: { ...room.rect, ...changes } })
  return (
    <div className={styles.champs}>
      <Champ label="Nom" committed={room.name} parse={analyseNom} onCommit={(v) => modifier({ name: String(v) })} />
      <Select
        label="Type"
        value={room.type}
        options={TYPES}
        onChange={(e) => modifier({ type: e.target.value as RoomType })}
      />
      <Champ label="X (m)" mono committed={metres(x)} parse={analyseMetres(0, true)} onCommit={(v) => rect({ x: Number(v) })} />
      <Champ label="Y (m)" mono committed={metres(y)} parse={analyseMetres(0, true)} onCommit={(v) => rect({ y: Number(v) })} />
      <Champ label="Largeur (m)" mono committed={metres(w)} parse={analyseMetres(50, false)} onCommit={(v) => rect({ w: Number(v) })} />
      <Champ label="Profondeur (m)" mono committed={metres(h)} parse={analyseMetres(50, false)} onCommit={(v) => rect({ h: Number(v) })} />
      <p className={styles.surface}>Surface : <span className={styles.mono}>{formatArea(w * h)}</span></p>
      <Button
        variant="danger"
        size="sm"
        onClick={() => supprimerEtFocaliser(dispatch)}
      >
        Supprimer la pièce
      </Button>
    </div>
  )
}
