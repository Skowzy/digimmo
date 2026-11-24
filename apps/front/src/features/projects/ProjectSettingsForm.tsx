import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { RuleParams } from '@digimmo/domain'
import { ApiError, issuesFor } from '../../lib/api'
import type { Terrain } from '../../lib/queries'
import { decimalToInput, metersToInput, parseDecimal, parseMeters, parseMetersOrZero } from '../../lib/units'
import { useEnvoiUnique } from '../../pages/useEnvoiUnique'
import { useFocusInvalide } from '../../pages/useFocusInvalide'
import { Alert, Button, Field, Select } from '../../ui'
import type { ProjectSettingsValues } from './valeursParDefaut'
import styles from './ProjectSettingsForm.module.css'

export type ProjectSettingsSubmit = { name: string; terrain?: Terrain; rules: RuleParams }

const PIECES = [
  ['chambre', 'Chambre'], ['sejour', 'Séjour'], ['cuisine', 'Cuisine'], ['sdb', 'Salle de bain'], ['wc', 'WC'],
] as const
type Piece = (typeof PIECES)[number][0]
const COTES = [['north', 'Nord'], ['south', 'Sud'], ['east', 'Est'], ['west', 'Ouest']] as const

type Props = {
  /** `terrain: null` + `terrainFige` : terrain non rectangulaire ; sinon terrain vide à saisir. */
  initial: ProjectSettingsValues
  terrainFige?: boolean
  submitLabel: string
  onSubmit: (values: ProjectSettingsSubmit) => void
  pending: boolean
  serverError: Error | null
}

type Erreurs = Record<string, string | undefined>

const MSG_TERRAIN = 'doit être comprise entre 5,00 et 1 000,00 m.'
const MSG_RECUL = 'Le recul doit être compris entre 0 et 50,00 m.'

export function ProjectSettingsForm({ initial, terrainFige = false, submitLabel, onSubmit, pending, serverError }: Props) {
  const [name, setName] = useState(initial.name)
  const [width, setWidth] = useState(initial.terrain ? metersToInput(initial.terrain.widthCm) : '')
  const [depth, setDepth] = useState(initial.terrain ? metersToInput(initial.terrain.depthCm) : '')
  const [street, setStreet] = useState<Terrain['street']>(initial.terrain?.street ?? 'north')
  const [recuVoie, setRecuVoie] = useState(metersToInput(initial.rules.setbackStreetCm))
  const [recuLimites, setRecuLimites] = useState(metersToInput(initial.rules.setbackSidesCm))
  const [emprise, setEmprise] = useState(decimalToInput(initial.rules.maxFootprintPct))
  const [surfaces, setSurfaces] = useState<Record<Piece, string>>(
    () => Object.fromEntries(PIECES.map(([k]) => [k, decimalToInput(initial.rules.minAreasM2[k] ?? 0)])) as Record<Piece, string>,
  )
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [tentative, setTentative] = useState(0)
  const formRef = useFocusInvalide(tentative)
  const verrou = useEnvoiUnique()

  // Le verrou est levé quand la requête du parent se termine.
  useEffect(() => {
    if (!pending) verrou.liberer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  const issues = serverError instanceof ApiError ? serverError.issues : []
  const champsServeur: Erreurs = {
    name: issuesFor(issues, 'name'),
    width: issuesFor(issues, 'terrain.widthCm'),
    depth: issuesFor(issues, 'terrain.depthCm'),
    street: issuesFor(issues, 'terrain.street'),
    recuVoie: issuesFor(issues, 'rules.setbackStreetCm'),
    recuLimites: issuesFor(issues, 'rules.setbackSidesCm'),
    emprise: issuesFor(issues, 'rules.maxFootprintPct'),
    ...Object.fromEntries(PIECES.map(([k]) => [k, issuesFor(issues, `rules.minAreasM2.${k}`)])),
  }
  const reconnues = ['name', 'terrain.widthCm', 'terrain.depthCm', 'terrain.street', 'rules.setbackStreetCm', 'rules.setbackSidesCm', 'rules.maxFootprintPct',
    ...PIECES.map(([k]) => `rules.minAreasM2.${k}`)]
  const autres = issues.filter((i) => !reconnues.some((r) => i.startsWith(`${r}: `)))
  const messageAlerte = serverError && (autres.length > 0 || !(serverError instanceof ApiError) || issues.length === 0)
    ? [...(issues.length === 0 ? [serverError.message] : []), ...autres]
    : []
  const err = (k: string) => erreurs[k] ?? champsServeur[k]

  function submit(e: FormEvent) {
    e.preventDefault()
    if (verrou.occupe()) return
    const locales: Erreurs = {}
    const nom = name.trim()
    if (!nom) locales.name = 'Saisissez un nom de projet.'
    else if (nom.length > 80) locales.name = 'Le nom ne doit pas dépasser 80 caractères.'

    let terrain: Terrain | undefined
    if (!terrainFige) {
      const w = parseMeters(width)
      const d = parseMeters(depth)
      if (w === null || w < 500 || w > 100000) locales.width = `La largeur ${MSG_TERRAIN}`
      if (d === null || d < 500 || d > 100000) locales.depth = `La profondeur ${MSG_TERRAIN}`
      if (w !== null && d !== null && !locales.width && !locales.depth) terrain = { widthCm: w, depthCm: d, street }
    }

    const rv = parseMetersOrZero(recuVoie)
    const rl = parseMetersOrZero(recuLimites)
    if (rv === null || rv > 5000) locales.recuVoie = MSG_RECUL
    if (rl === null || rl > 5000) locales.recuLimites = MSG_RECUL
    const emp = parseDecimal(emprise, 2)
    if (emp === null || emp < 1 || emp > 100) locales.emprise = "L'emprise doit être comprise entre 1 et 100 %."
    const minAreasM2: Partial<Record<Piece, number>> = {}
    for (const [k] of PIECES) {
      const n = parseDecimal(surfaces[k], 2)
      if (n === null || n > 100) locales[k] = 'La surface doit être comprise entre 0 et 100 m².'
      else minAreasM2[k] = n
    }

    setErreurs(locales)
    if (Object.values(locales).some(Boolean)) {
      setTentative((n) => n + 1)
      return
    }
    verrou.prendre()
    onSubmit({
      name: nom,
      ...(terrain ? { terrain } : {}),
      rules: { setbackStreetCm: rv as number, setbackSidesCm: rl as number, maxFootprintPct: emp as number, minAreasM2 },
    })
  }

  return (
    <form noValidate onSubmit={submit} ref={formRef} className={styles.form}>
      {messageAlerte.length > 0 && <Alert>{messageAlerte.map((m) => <div key={m}>{m}</div>)}</Alert>}
      <Field label="Nom du projet" value={name} onChange={(e) => setName(e.target.value)} error={err('name')} autoComplete="off" />
      <fieldset className={styles.groupe}>
        <legend>Terrain</legend>
        {terrainFige && <Alert tone="warning">Terrain non rectangulaire : modification non prise en charge.</Alert>}
        <Field label="Largeur (m)" inputMode="decimal" mono value={width} onChange={(e) => setWidth(e.target.value)} error={err('width')} disabled={terrainFige} />
        <Field label="Profondeur (m)" inputMode="decimal" mono value={depth} onChange={(e) => setDepth(e.target.value)} error={err('depth')} disabled={terrainFige} />
        <Select label="Côté de la voie" value={street} error={err('street')} disabled={terrainFige}
          onChange={(e) => setStreet(e.target.value as Terrain['street'])}
          options={COTES.map(([value, label]) => ({ value, label }))} />
      </fieldset>
      <fieldset className={styles.groupe}>
        <legend>Règles du PLU</legend>
        <Field label="Recul sur voie (m)" inputMode="decimal" mono value={recuVoie} onChange={(e) => setRecuVoie(e.target.value)} error={err('recuVoie')} />
        <Field label="Recul sur limites séparatives (m)" inputMode="decimal" mono value={recuLimites} onChange={(e) => setRecuLimites(e.target.value)} error={err('recuLimites')} />
        <Field label="Emprise au sol max (%)" inputMode="decimal" mono value={emprise} onChange={(e) => setEmprise(e.target.value)} error={err('emprise')} />
        <p className={styles.aide}>Valeurs indicatives : reportez celles du PLU de votre commune.</p>
      </fieldset>
      <fieldset className={styles.groupe}>
        <legend>Surfaces minimales</legend>
        {PIECES.map(([k, l]) => (
          <Field key={k} label={`${l} (m²)`} inputMode="decimal" mono value={surfaces[k]}
            onChange={(e) => setSurfaces((s) => ({ ...s, [k]: e.target.value }))} error={err(k)} />
        ))}
      </fieldset>
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>{submitLabel}</Button>
      </div>
    </form>
  )
}
