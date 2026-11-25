import { NavLink, Link, Outlet } from 'react-router'
import { useLogout, useMe } from '../lib/auth'
import { Button } from '../ui'
import styles from './AppShell.module.css'

export const AVERTISSEMENT =
  'Digimmo ne remplace ni un architecte ni un constructeur. Les plans sont indicatifs.'

export function AppShell() {
  const me = useMe().data
  const logout = useLogout()
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#contenu">
        Aller au contenu
      </a>
      <header className={styles.header}>
        <Link className={styles.brand} to={me ? '/projets' : '/'}>
          DIGIMMO
        </Link>
        <nav className={styles.nav} aria-label="Navigation principale">
          {me ? (
            <>
              <NavLink to="/projets" end>Mes projets</NavLink>
              <NavLink to="/compte">Mon compte</NavLink>
              {me.role === 'admin' && <NavLink to="/admin/catalogue">Catalogue</NavLink>}
              <Button variant="ghost" size="sm" loading={logout.isPending} onClick={() => logout.mutate()}>
                Se déconnecter
              </Button>
            </>
          ) : (
            <>
              <NavLink to="/connexion">Connexion</NavLink>
              <NavLink to="/inscription">Créer un compte</NavLink>
            </>
          )}
        </nav>
      </header>
      <main id="contenu" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className={styles.footer}>{AVERTISSEMENT}</footer>
    </div>
  )
}
