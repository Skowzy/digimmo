import { useState } from 'react'
import { Alert, Button, ButtonLink, Field, Modal, PageHeader, RuleBadge, Select, ToolButton } from '../ui'
import styles from './DesignSystemPage.module.css'
import { useTitrePage } from '../app/useTitrePage'

const COULEURS = [
  ['papier', ''], ['papier-2', ''], ['trait', ''], ['encre', ''], ['encre-2', ''],
  ['sanguine', 'erreur'], ['sauge', 'valide'], ['ocre', 'alerte'], ['blanc', ''],
] as const

const HEX: Record<string, string> = {
  papier: '#f4efe4', 'papier-2': '#ebe4d4', trait: '#c9bfa8', encre: '#2b3a55', 'encre-2': '#5a6680',
  sanguine: '#a33a2f', sauge: '#3f6b41', ocre: '#845a10', blanc: '#fbf8f1',
}

const OUTILS = [
  ['Sélection', '↖'], ['Terrain', '▭'], ['Pièce', '⌂'], ['Mobilier', '⊞'], ['Mesurer', '⟷'], ['Défaire', '↶'],
] as const

export function DesignSystemPage() {
  useTitrePage('Design system')
  const [modale, setModale] = useState(false)
  const [outil, setOutil] = useState('Pièce')
  return (
    <div className={`${styles.page} grille`}>
      <PageHeader title="Design system « Calque d'architecte »" subtitle="Tokens et composants de base de Digimmo." />

      <section className={styles.section} aria-labelledby="ds-couleurs">
        <h2 id="ds-couleurs">Couleurs</h2>
        <div className={styles.row}>
          {COULEURS.map(([nom, role]) => (
            <div key={nom} className={styles.sw}>
              <div className={`${styles.chip} ${styles[`chip-${nom}`]}`} />
              <code>{nom}</code>
              {role && <span>{role}</span>}
              <br />
              {HEX[nom]}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-typo">
        <h2 id="ds-typo">Typographie</h2>
        <p className={styles.titre}>Maison Dupont</p>
        <p className={styles.sousTitre}>Plan du rez-de-chaussée</p>
        <p>Ajoutez une pièce puis faites-la glisser sur le terrain.</p>
        <p className={styles.cote}>4,20 m × 3,60 m · 15,12 m²</p>
      </section>

      <section className={styles.section} aria-labelledby="ds-liens-boutons">
        <h2 id="ds-liens-boutons">Liens-boutons</h2>
        <div className={styles.row}>
          <ButtonLink to="/design-system">Nouveau projet</ButtonLink>
          <ButtonLink to="/design-system" variant="secondary">Voir les projets</ButtonLink>
          <ButtonLink to="/design-system" variant="ghost">Retour</ButtonLink>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-boutons">
        <h2 id="ds-boutons">Boutons</h2>
        <div className={styles.row}>
          <Button>Enregistrer</Button>
          <Button variant="secondary">Exporter en PDF</Button>
          <Button variant="ghost">Annuler</Button>
          <Button variant="danger">Supprimer le projet</Button>
          <Button disabled>Désactivé</Button>
          <Button loading>Chargement</Button>
        </div>
        <div className={`${styles.row} ${styles.rangeeSuivante}`}>
          <Button size="sm">+ Pièce</Button>
          <Button size="sm" variant="secondary">Dupliquer</Button>
          <Button size="sm" variant="ghost">Détails</Button>
          <Button size="sm" variant="danger">Retirer</Button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-champs">
        <h2 id="ds-champs">Champs</h2>
        <div className={styles.row}>
          <Field label="Nom du projet" defaultValue="Maison Dupont" />
          <Field label="Largeur du terrain" mono defaultValue="20,00 m" />
          <Field label="Recul minimal" mono defaultValue="2,00 m" error="Le PLU impose au moins 3 m" />
          <Select label="Côté de la voie" defaultValue="south" options={[{ value: 'north', label: 'Nord' }, { value: 'south', label: 'Sud' }, { value: 'east', label: 'Est' }, { value: 'west', label: 'Ouest' }]} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-pastilles">
        <h2 id="ds-pastilles">Pastilles</h2>
        <div className={styles.row}>
          <RuleBadge severity="ok">Dans le terrain</RuleBadge>
          <RuleBadge severity="ok">Recul 5 m respecté</RuleBadge>
          <RuleBadge severity="warning">Emprise à 92 % du max</RuleBadge>
          <RuleBadge severity="error">Chambre 1 &lt; 9 m²</RuleBadge>
          <RuleBadge severity="error">Chevauchement : lit / armoire</RuleBadge>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-outils">
        <h2 id="ds-outils">Barre d'outils</h2>
        <div className={styles.toolbar} role="toolbar" aria-label="Outils de l'éditeur">
          {OUTILS.map(([label, icon]) => (
            <ToolButton key={label} label={label} icon={icon} active={outil === label} onClick={() => setOutil(label)} />
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-alertes">
        <h2 id="ds-alertes">Alertes</h2>
        <div className={styles.alertes}>
          <Alert tone="error" title="Enregistrement impossible">Le serveur ne répond pas.</Alert>
          <Alert tone="warning">L'emprise approche du maximum autorisé.</Alert>
          <Alert tone="info">Les cotes sont exprimées en mètres.</Alert>
          <Alert tone="success">Projet enregistré.</Alert>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-modale">
        <h2 id="ds-modale">Modale</h2>
        <Button variant="secondary" onClick={() => setModale(true)}>Ouvrir la modale</Button>
        <Modal
          open={modale}
          title="Supprimer le projet"
          onClose={() => setModale(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModale(false)}>Annuler</Button>
              <Button variant="danger" onClick={() => setModale(false)}>Supprimer</Button>
            </>
          }
        >
          Cette action est définitive.
        </Modal>
      </section>
    </div>
  )
}
