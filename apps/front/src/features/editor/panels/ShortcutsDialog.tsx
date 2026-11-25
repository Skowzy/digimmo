import { Button, Modal } from '../../../ui'
import styles from '../EditorPage.module.css'

const RACCOURCIS: [string, string][] = [
  ['V', 'Outil Sélection'],
  ['P', 'Outil Pièce'],
  ['D', 'Outil Porte'],
  ['F', 'Outil Fenêtre'],
  ['M', 'Outil Meuble'],
  ['E', 'Outil Escalier (si un étage existe)'],
  ['R', 'Tourner le meuble sélectionné'],
  ['Flèches', 'Déplacer la sélection de 10 cm'],
  ['Maj + flèche', 'Déplacer la sélection de 1 cm'],
  ['Suppr / Retour arrière', 'Supprimer la sélection'],
  ['Échap', 'Annuler le geste, désarmer le meuble ou désélectionner'],
  ['Ctrl/Cmd + Z', 'Annuler'],
  ['Ctrl/Cmd + Maj + Z', 'Rétablir'],
  ['Ctrl/Cmd + Y', 'Rétablir'],
  ['Ctrl/Cmd + S', 'Enregistrer maintenant'],
  ['Espace + glisser', 'Déplacer la vue'],
  ['?', 'Afficher cette aide'],
]

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Raccourcis clavier" onClose={onClose} footer={<Button onClick={onClose}>Fermer</Button>}>
      <table className={styles.raccourcis}>
        <caption className={styles.cache}>Liste des raccourcis clavier de l'éditeur</caption>
        <thead><tr><th scope="col">Touche</th><th scope="col">Action</th></tr></thead>
        <tbody>
          {RACCOURCIS.map(([touche, action]) => (
            <tr key={touche}><td><kbd>{touche}</kbd></td><td>{action}</td></tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}
