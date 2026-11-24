import { AVERTISSEMENT } from '../app/AppShell'
import { FlashMessage } from '../app/FlashMessage'
import { useMe } from '../lib/auth'
import { Alert, ButtonLink } from '../ui'
import styles from './HomePage.module.css'
import { useTitrePage } from '../app/useTitrePage'

/** Aperçu décoratif dans le style « calque » : contour de terrain en tirets, pièces, une porte. */
function Calque() {
  return (
    <svg className={styles.calque} viewBox="0 0 240 180" aria-hidden="true" focusable="false">
      <rect className={styles.terrain} x="10" y="10" width="220" height="160" />
      <rect className={styles.piece} x="40" y="35" width="90" height="70" />
      <rect className={styles.piece} x="130" y="35" width="70" height="70" />
      <rect className={styles.piece} x="40" y="105" width="160" height="40" />
      <path className={styles.porte} d="M 90 105 L 90 85 A 20 20 0 0 1 110 105" />
    </svg>
  )
}

export function HomePage() {
  useTitrePage()
  const me = useMe()
  return (
    <div className={styles.accueil}>
      <FlashMessage />
      <section className={styles.hero}>
        <div>
          <h1 className={styles.titre}>Agencez votre future maison, pièce par pièce.</h1>
          <p className={styles['sous-titre']}>
            Dessinez votre terrain, respectez les règles du PLU de votre commune et placez vos pièces et vos meubles sur un plan à l’échelle.
          </p>
          <div className={styles.actions}>
            {me.data ? (
              <ButtonLink to="/projets">Mes projets</ButtonLink>
            ) : (
              !me.isPending && (
                <>
                  <ButtonLink to="/inscription">Créer un compte</ButtonLink>
                  <ButtonLink to="/connexion" variant="secondary">Se connecter</ButtonLink>
                </>
              )
            )}
          </div>
        </div>
        <Calque />
      </section>
      <div className={styles.avertissement}>
        <Alert tone="info">{AVERTISSEMENT}</Alert>
      </div>
    </div>
  )
}
