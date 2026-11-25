import { useEffect, useRef, useState } from 'react'
import { formatArea, formatMeters, furnitureFootprint, type Furniture, type Opening, type Rect, type Room, type RoomType } from '@digimmo/domain'
import { parseMeters, parseMetersOrZero } from '../../../lib/units'
import { Button, Field, Select } from '../../../ui'
import { LARGEUR_MAX, LARGEUR_MIN } from '../geometry/openings'
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
  const ouverture = sel?.kind === 'opening' ? level.openings.find((x) => x.id === sel.id) : undefined
  const meuble = sel?.kind === 'furniture' ? level.furniture.find((x) => x.id === sel.id) : undefined
  const escalier = sel?.kind === 'stairs' ? state.plan.stairs : null
  return (
    <section aria-labelledby="ed-proprietes" className={styles.panneau}>
      <h2 id="ed-proprietes">Propriétés</h2>
      {room ? <PanneauPiece key={room.id} room={room} />
        : ouverture ? <PanneauOuverture key={ouverture.id} o={ouverture} />
        : escalier ? <PanneauEscalier rect={escalier.rect} />
        : meuble ? <PanneauMeuble key={meuble.id} f={meuble} />
          : <p>Sélectionnez un élément du plan.</p>}
    </section>
  )
}

function supprimerEtFocaliser(dispatch: ReturnType<typeof useEditor>['dispatch']) {
  dispatch({ type: 'deleteSelection' })
  document.querySelector<SVGSVGElement>('svg[aria-label="Plan du projet"]')?.focus()
}

const TAILLE_MIN = 10
const TAILLE_MAX = 1000
const analyseTaille = (max: number) => (texte: string): Analyse => {
  const cm = parseMeters(texte)
  return cm === null || cm < TAILLE_MIN || cm > max
    ? { ok: false, error: `Valeur entre ${formatMeters(TAILLE_MIN)} et ${formatMeters(max)}` } : { ok: true, value: cm }
}

function PanneauMeuble({ f }: { f: Furniture }) {
  const { dispatch } = useEditor()
  const fp = furnitureFootprint(f)
  const modifier = (changes: Partial<Omit<Furniture, 'id'>>) => dispatch({ type: 'updateFurniture', id: f.id, changes })
  const tourne = f.rotation === 90 || f.rotation === 270
  // La largeur (resp. profondeur) occupe l'axe X (resp. Y) de l'empreinte, ou l'inverse quand le meuble est tourné.
  const maxW = Math.min(TAILLE_MAX, MAX - (tourne ? f.y : f.x))
  const maxD = Math.min(TAILLE_MAX, MAX - (tourne ? f.x : f.y))
  const analysePos = (taille: number) => (texte: string): Analyse => {
    const cm = parseMetersOrZero(texte)
    const max = MAX - taille
    return cm === null || cm < 0 || cm > max ? { ok: false, error: `Valeur entre ${formatMeters(0)} et ${formatMeters(max)}` } : { ok: true, value: cm }
  }
  return (
    <div className={styles.champs}>
      <h3 className={styles.titreElement}>Meuble : {f.label}</h3>
      <Champ label="Libellé" committed={f.label} parse={analyseNom} onCommit={(v) => modifier({ label: String(v) })} />
      <Champ label="X (m)" mono committed={metres(f.x)} parse={analysePos(fp.w)} onCommit={(v) => modifier({ x: Number(v) })} />
      <Champ label="Y (m)" mono committed={metres(f.y)} parse={analysePos(fp.h)} onCommit={(v) => modifier({ y: Number(v) })} />
      <Champ label="Largeur (m)" mono committed={metres(f.w)} parse={analyseTaille(maxW)} onCommit={(v) => modifier({ w: Number(v) })} />
      <Champ label="Profondeur (m)" mono committed={metres(f.d)} parse={analyseTaille(maxD)} onCommit={(v) => modifier({ d: Number(v) })} />
      <p className={styles.surface}>Rotation : <span className={styles.mono}>{f.rotation}°</span></p>
      <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'rotateFurniture', id: f.id })}>Tourner d'un quart de tour</Button>
      <Button variant="danger" size="sm" onClick={() => supprimerEtFocaliser(dispatch)}>Supprimer le meuble</Button>
    </div>
  )
}

const analyseLargeur = (texte: string): Analyse => {
  const cm = parseMeters(texte)
  return cm === null || cm < LARGEUR_MIN || cm > LARGEUR_MAX
    ? { ok: false, error: `Valeur entre ${formatMeters(LARGEUR_MIN)} et ${formatMeters(LARGEUR_MAX)}` } : { ok: true, value: cm }
}

function PanneauOuverture({ o }: { o: Opening }) {
  const { dispatch } = useEditor()
  const porte = o.kind === 'door'
  const modifier = (changes: Partial<Omit<Opening, 'id'>>) => dispatch({ type: 'updateOpening', id: o.id, changes })
  const swing = (changes: Partial<NonNullable<Opening['swing']>>) => o.swing && modifier({ swing: { ...o.swing, ...changes } })
  const analysePosition = (texte: string): Analyse => {
    const cm = parseMetersOrZero(texte)
    const max = MAX - o.width
    return cm === null || cm < 0 || cm > max ? { ok: false, error: `Valeur entre ${formatMeters(0)} et ${formatMeters(max)}` } : { ok: true, value: cm }
  }
  return (
    <div className={styles.champs}>
      <h3 className={styles.titreElement}>{porte ? 'Porte' : 'Fenêtre'}</h3>
      <Champ label="Largeur (m)" mono committed={metres(o.width)} parse={analyseLargeur} onCommit={(v) => modifier({ width: Number(v) })} />
      <Champ label="Position (m)" mono committed={metres(o.start)} parse={analysePosition} onCommit={(v) => modifier({ start: Number(v) })} />
      {porte && o.swing && (
        <>
          <Select
            label="Charnière"
            value={o.swing.hinge}
            options={[{ value: 'start', label: 'Début' }, { value: 'end', label: 'Fin' }]}
            onChange={(e) => swing({ hinge: e.target.value as 'start' | 'end' })}
          />
          <Select
            label="Ouverture"
            value={o.swing.side}
            options={[{ value: 'neg', label: 'Côté A' }, { value: 'pos', label: 'Côté B' }]}
            onChange={(e) => swing({ side: e.target.value as 'neg' | 'pos' })}
          />
        </>
      )}
      <Button variant="danger" size="sm" onClick={() => supprimerEtFocaliser(dispatch)}>
        {porte ? 'Supprimer la porte' : 'Supprimer la fenêtre'}
      </Button>
    </div>
  )
}

function PanneauEscalier({ rect: r }: { rect: Rect }) {
  const { dispatch } = useEditor()
  const rect = (changes: Partial<Rect>) => dispatch({ type: 'setStairs', rect: { ...r, ...changes } })
  return (
    <div className={styles.champs}>
      <h3 className={styles.titreElement}>Escalier</h3>
      <Champ label="X (m)" mono committed={metres(r.x)} parse={analyseMetres(0, true)} onCommit={(v) => rect({ x: Number(v) })} />
      <Champ label="Y (m)" mono committed={metres(r.y)} parse={analyseMetres(0, true)} onCommit={(v) => rect({ y: Number(v) })} />
      <Champ label="Largeur (m)" mono committed={metres(r.w)} parse={analyseMetres(50, false)} onCommit={(v) => rect({ w: Number(v) })} />
      <Champ label="Longueur (m)" mono committed={metres(r.h)} parse={analyseMetres(50, false)} onCommit={(v) => rect({ h: Number(v) })} />
      <Button variant="danger" size="sm" onClick={() => supprimerEtFocaliser(dispatch)}>Supprimer l'escalier</Button>
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
