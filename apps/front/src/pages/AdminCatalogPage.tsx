import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { formatMeters } from '@digimmo/domain'
import { FlashMessage } from '../app/FlashMessage'
import { ApiError, issuesFor } from '../lib/api'
import { useCatalog, useCreateFurniture, useDeleteFurniture, useUpdateFurniture } from '../lib/queries'
import type { FurnitureCategory, FurnitureItem } from '../lib/queries'
import { metersToInput, parseMeters } from '../lib/units'
import { Alert, Button, Field, Modal, PageHeader, Select } from '../ui'
import styles from './AdminCatalogPage.module.css'
import { useEnvoiUnique } from './useEnvoiUnique'
import { useFocusInvalide } from './useFocusInvalide'

const CATEGORIES: [FurnitureCategory, string][] = [
  ['chambre', 'Chambre'],
  ['cuisine', 'Cuisine'],
  ['sdb', 'Salle de bain'],
  ['sejour', 'Séjour'],
  ['autre', 'Autre'],
]
const MIN_CM = 1
const MAX_CM = 1000

type Edition = { item: FurnitureItem | null; n: number }

function FurnitureForm({ edition, open, onClose }: { edition: Edition; open: boolean; onClose: () => void }) {
  const { item } = edition
  const creation = useCreateFurniture()
  const miseAJour = useUpdateFurniture()
  const mutation = item ? miseAJour : creation
  const envoi = useEnvoiUnique()
  const [category, setCategory] = useState<FurnitureCategory>(item?.category ?? 'chambre')
  const [name, setName] = useState(item?.name ?? '')
  const [width, setWidth] = useState(item ? metersToInput(item.widthCm) : '')
  const [depth, setDepth] = useState(item ? metersToInput(item.depthCm) : '')
  const [symbol, setSymbol] = useState(item?.symbol ?? '')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [tentative, setTentative] = useState(0)
  const formRef = useFocusInvalide(tentative)

  const issues = mutation.error instanceof ApiError ? mutation.error.issues : []
  const err = (champ: string) => erreurs[champ] ?? issuesFor(issues, champ === 'width' ? 'widthCm' : champ === 'depth' ? 'depthCm' : champ)

  function valider(e: FormEvent) {
    e.preventDefault()
    if (envoi.occupe()) return
    const w = parseMeters(width)
    const d = parseMeters(depth)
    const nouvelles: Record<string, string> = {}
    const n = name.trim()
    const s = symbol.trim()
    if (n.length < 1 || n.length > 60) nouvelles.name = 'Le nom doit comporter entre 1 et 60 caractères.'
    if (w === null || w < MIN_CM || w > MAX_CM) nouvelles.width = 'La largeur doit être comprise entre 0,01 m et 10,00 m.'
    if (d === null || d < MIN_CM || d > MAX_CM) nouvelles.depth = 'La profondeur doit être comprise entre 0,01 m et 10,00 m.'
    if (s.length < 1 || s.length > 40) nouvelles.symbol = 'Le pictogramme doit comporter entre 1 et 40 caractères.'
    setErreurs(nouvelles)
    if (Object.keys(nouvelles).length > 0 || w === null || d === null) {
      setTentative((t) => t + 1)
      return
    }
    envoi.prendre()
    const corps = { category, name: n, widthCm: w, depthCm: d, symbol: s }
    const options = { onSuccess: onClose, onSettled: envoi.liberer }
    if (item) miseAJour.mutate({ id: item.id, ...corps }, options)
    else creation.mutate(corps, options)
  }

  const titre = item ? 'Modifier le meuble' : 'Ajouter un meuble'
  return (
    <Modal
      open={open}
      title={titre}
      onClose={() => { if (!envoi.occupe()) onClose() }}
      footer={
        <>
          <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>Annuler</Button>
          <Button type="submit" form="form-meuble" loading={mutation.isPending}>Enregistrer</Button>
        </>
      }
    >
      <form id="form-meuble" className={styles.form} noValidate onSubmit={valider} ref={formRef}>
        <Select id="meuble-categorie" label="Catégorie" value={category} error={err('category')}
          onChange={(e) => setCategory(e.target.value as FurnitureCategory)}
          options={CATEGORIES.map(([value, label]) => ({ value, label }))} />
        <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} error={err('name')} />
        <Field label="Largeur (m)" inputMode="decimal" mono value={width} onChange={(e) => setWidth(e.target.value)} error={err('width')} />
        <Field label="Profondeur (m)" inputMode="decimal" mono value={depth} onChange={(e) => setDepth(e.target.value)} error={err('depth')} />
        <Field label="Pictogramme" value={symbol} onChange={(e) => setSymbol(e.target.value)} error={err('symbol')} />
      </form>
      {mutation.error && <Alert>{mutation.error.message}</Alert>}
    </Modal>
  )
}

export function AdminCatalogPage() {
  const { data: catalogue, isPending, error } = useCatalog()
  const suppression = useDeleteFurniture()
  const verrou = useEnvoiUnique()
  const [edition, setEdition] = useState<Edition>({ item: null, n: 0 })
  const [ouvert, setOuvert] = useState(false)
  const ouvrir = (item: FurnitureItem | null) => {
    setEdition((e) => ({ item, n: e.n + 1 }))
    setOuvert(true)
  }
  const [aSupprimer, setASupprimer] = useState<FurnitureItem | null>(null)

  const titre = useRef<HTMLHeadingElement>(null)
  const [focusTitre, setFocusTitre] = useState(0)
  useEffect(() => {
    if (focusTitre > 0) titre.current?.focus()
  }, [focusTitre])

  function confirmer() {
    if (!aSupprimer || verrou.occupe()) return
    verrou.prendre()
    suppression.mutate(aSupprimer.id, {
      onSettled: verrou.liberer,
      onSuccess: () => {
        setASupprimer(null)
        setFocusTitre((n) => n + 1)
      },
    })
  }
  function fermerSuppression() {
    if (verrou.occupe()) return
    setASupprimer(null)
    suppression.reset()
  }

  return (
    <div>
      <FlashMessage />
      <PageHeader
        title="Catalogue"
        titleRef={titre}
        actions={<Button onClick={() => ouvrir(null)}>Ajouter un meuble</Button>}
      />
      {error && <Alert>{error.message}</Alert>}
      {isPending && !error && <p>Chargement…</p>}
      {catalogue?.length === 0 && <p>Aucun meuble dans le catalogue. Ajoutez-en un.</p>}
      {CATEGORIES.map(([cat, libelle]) => {
        const lignes = catalogue?.filter((i) => i.category === cat) ?? []
        if (lignes.length === 0) return null
        return (
          <div key={cat} className={styles.defilement} tabIndex={0} role="region" aria-label={`Meubles : ${libelle}`}>
            <table className={styles.table}>
              <caption>{libelle}</caption>
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col">Largeur</th>
                  <th scope="col">Profondeur</th>
                  <th scope="col">Pictogramme</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((i) => (
                  <tr key={i.id}>
                    <th scope="row">{i.name}</th>
                    <td className={styles.mono}>{formatMeters(i.widthCm)}</td>
                    <td className={styles.mono}>{formatMeters(i.depthCm)}</td>
                    <td>{i.symbol}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button variant="secondary" aria-label={`Modifier ${i.name}`} onClick={() => ouvrir(i)}>Modifier</Button>
                        <Button variant="danger" aria-label={`Supprimer ${i.name}`} onClick={() => setASupprimer(i)}>Supprimer</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
      <FurnitureForm key={edition.n} edition={edition} open={ouvert} onClose={() => setOuvert(false)} />
      <Modal
        open={aSupprimer !== null}
        title="Supprimer ce meuble ?"
        onClose={fermerSuppression}
        footer={
          <>
            <Button variant="secondary" disabled={suppression.isPending} onClick={fermerSuppression}>Annuler</Button>
            <Button variant="danger" loading={suppression.isPending} onClick={confirmer}>Supprimer</Button>
          </>
        }
      >
        <p>« {aSupprimer?.name} » sera retiré du catalogue.</p>
        {suppression.error && <Alert>{suppression.error.message}</Alert>}
      </Modal>
    </div>
  )
}
