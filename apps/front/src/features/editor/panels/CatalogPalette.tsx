import { useEffect } from 'react'
import { useCatalog, type FurnitureItem } from '../../../lib/queries'
import { Alert, Button } from '../../../ui'
import { useEditor } from '../state/useEditor'
import styles from './CatalogPalette.module.css'

const CATEGORIES: { value: FurnitureItem['category']; label: string }[] = [
  { value: 'chambre', label: 'Chambre' },
  { value: 'cuisine', label: 'Cuisine' },
  { value: 'sdb', label: 'Salle de bain' },
  { value: 'sejour', label: 'Séjour' },
  { value: 'autre', label: 'Autre' },
]

const metres = (cm: number) => (cm / 100).toFixed(2).replace('.', ',')

/** Palette des meubles du catalogue, visible tant que l'outil Meuble est actif. */
export function CatalogPalette() {
  const { state, dispatch } = useEditor()
  const catalogue = useCatalog()
  const { pendingFurniture } = state
  const inconnu = catalogue.data !== undefined && pendingFurniture !== null && !catalogue.data.some((i) => i.id === pendingFurniture)
  useEffect(() => { if (inconnu) dispatch({ type: 'armFurniture', catalogId: null }) }, [inconnu, dispatch])
  if (state.tool !== 'furniture') return null
  return (
    <section
      aria-labelledby="ed-meubles"
      className={styles.palette}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && state.pendingFurniture) { e.stopPropagation(); dispatch({ type: 'armFurniture', catalogId: null }) }
      }}
    >
      <h2 id="ed-meubles">Meubles</h2>
      {catalogue.isError ? (
        <>
          <Alert>Catalogue indisponible.</Alert>
          <Button variant="secondary" size="sm" onClick={() => void catalogue.refetch()}>Réessayer</Button>
        </>
      ) : !catalogue.data ? (
        <p role="status">Chargement du catalogue…</p>
      ) : (
        CATEGORIES.map((c) => {
          const items = catalogue.data.filter((i) => i.category === c.value)
          if (items.length === 0) return null
          return (
            <div key={c.value}>
              <h3 className={styles.groupe}>{c.label}</h3>
              <ul className={styles.liste}>
                {items.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      className={styles.item}
                      aria-pressed={state.pendingFurniture === i.id}
                      onClick={() => dispatch({ type: 'armFurniture', catalogId: state.pendingFurniture === i.id ? null : i.id })}
                    >
                      <span>{i.name}</span>{' '}
                      <span className={styles.cote}>{metres(i.widthCm)} × {metres(i.depthCm)} m</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })
      )}
    </section>
  )
}
