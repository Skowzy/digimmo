import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FlashMessage } from '../app/FlashMessage'
import { ApiError, issuesFor } from '../lib/api'
import { cheminSuite, useLogin } from '../lib/auth'
import { Alert, Button, Field, PageHeader } from '../ui'
import styles from './AuthPage.module.css'
import { useEnvoiUnique } from './useEnvoiUnique'
import { useFocusInvalide } from './useFocusInvalide'

export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreurs, setErreurs] = useState<{ email?: string; password?: string }>({})
  const [message, setMessage] = useState<string | null>(null)
  const [tentative, setTentative] = useState(0)
  const formRef = useFocusInvalide(tentative)
  const verrou = useEnvoiUnique()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (verrou.occupe()) return
    setMessage(null)
    const locales = {
      email: email.trim() ? undefined : "Saisissez votre adresse e-mail.",
      password: password ? undefined : 'Saisissez votre mot de passe.',
    }
    setErreurs(locales)
    if (locales.email || locales.password) {
      setTentative((n) => n + 1)
      return
    }
    verrou.prendre()
    login.mutate(
      { email: email.trim(), password },
      {
        onSettled: verrou.liberer,
        onSuccess: () => navigate(cheminSuite(params.get('suite'))),
        onError: (err) => {
          const issues = err instanceof ApiError ? err.issues : []
          const champs = { email: issuesFor(issues, 'email'), password: issuesFor(issues, 'password') }
          setErreurs(champs)
          if (champs.email || champs.password) setTentative((n) => n + 1)
          else setMessage(err instanceof Error ? err.message : 'Erreur inattendue.')
        },
      },
    )
  }

  return (
    <div className={styles.page}>
      <FlashMessage />
      <PageHeader title="Connexion" />
      {message && <Alert>{message}</Alert>}
      <form noValidate onSubmit={onSubmit} ref={formRef} className={styles.form}>
        <Field label="Adresse e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={erreurs.email} />
        <Field label="Mot de passe" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={erreurs.password} />
        <Button type="submit" loading={login.isPending}>Se connecter</Button>
      </form>
      <p className={styles.links}>
        <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        <Link to="/inscription">Créer un compte</Link>
      </p>
    </div>
  )
}
