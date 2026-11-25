import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError, issuesFor } from '../lib/api'
import { useRegister } from '../lib/auth'
import { Alert, Button, Field, PageHeader } from '../ui'
import styles from './AuthPage.module.css'
import { useEnvoiUnique } from './useEnvoiUnique'
import { useFocusInvalide } from './useFocusInvalide'
import { useTitrePage } from '../app/useTitrePage'

type Erreurs = { email?: string; password?: string; confirmation?: string }

export function RegisterPage() {
  useTitrePage('Créer un compte')
  const navigate = useNavigate()
  const register = useRegister()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [message, setMessage] = useState<string | null>(null)
  const [tentative, setTentative] = useState(0)
  const formRef = useFocusInvalide(tentative)
  const verrou = useEnvoiUnique()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (verrou.occupe()) return
    setMessage(null)
    const locales: Erreurs = {
      email: email.trim() ? undefined : 'Saisissez votre adresse e-mail.',
      password: password.length >= 10 ? undefined : '10 caractères minimum.',
      confirmation: confirmation === password ? undefined : 'Les mots de passe ne correspondent pas.',
    }
    setErreurs(locales)
    if (locales.email || locales.password || locales.confirmation) {
      setTentative((n) => n + 1)
      return
    }
    verrou.prendre()
    register.mutate(
      { email: email.trim(), password },
      {
        onSettled: verrou.liberer,
        onSuccess: () => navigate('/projets'),
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
      <PageHeader title="Créer un compte" />
      {message && <Alert>{message}</Alert>}
      <form noValidate onSubmit={onSubmit} ref={formRef} className={styles.form}>
        <Field label="Adresse e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={erreurs.email} />
        <Field label="Mot de passe" type="password" autoComplete="new-password" hint="10 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} error={erreurs.password} />
        <Field label="Confirmation du mot de passe" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} error={erreurs.confirmation} />
        <Button type="submit" loading={register.isPending}>S'inscrire</Button>
      </form>
      <p className={styles.links}>
        <Link to="/connexion">Déjà un compte ? Se connecter</Link>
      </p>
    </div>
  )
}
