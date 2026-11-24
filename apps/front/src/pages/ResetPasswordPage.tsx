import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError, issuesFor } from '../lib/api'
import { Alert, Button, Field, PageHeader } from '../ui'
import styles from './AuthPage.module.css'
import { useEnvoiUnique } from './useEnvoiUnique'
import { useFocusInvalide } from './useFocusInvalide'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  // Le jeton n'est lu qu'une fois (au montage) puis conservé en mémoire seulement.
  const [token] = useState(() => new URLSearchParams(search).get('token'))
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreurs, setErreurs] = useState<{ password?: string; confirmation?: string }>({})
  const [message, setMessage] = useState<string | null>(null)
  const [tentative, setTentative] = useState(0)
  const formRef = useFocusInvalide(tentative)
  const verrou = useEnvoiUnique()
  const reset = useMutation({
    mutationFn: (body: { token: string; password: string }) =>
      api<void>('/auth/password/reset', { method: 'POST', body }),
  })

  // navigate(replace) passe par l'historique du routeur : l'état du routeur reste synchrone
  // avec l'URL (history.replaceState direct le désynchroniserait), et le jeton quitte l'historique.
  useEffect(() => {
    if (search) navigate(pathname, { replace: true })
  }, [search, pathname, navigate])

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'no-referrer'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token || verrou.occupe()) return
    setMessage(null)
    const locales = {
      password: password.length >= 10 ? undefined : '10 caractères minimum.',
      confirmation: confirmation === password ? undefined : 'Les mots de passe ne correspondent pas.',
    }
    setErreurs(locales)
    if (locales.password || locales.confirmation) {
      setTentative((n) => n + 1)
      return
    }
    verrou.prendre()
    reset.mutate(
      { token, password },
      {
        onSettled: verrou.liberer,
        onSuccess: () => navigate('/connexion', { state: { flash: 'Mot de passe modifié. Connectez-vous.' } }),
        onError: (err) => {
          const champ = err instanceof ApiError ? issuesFor(err.issues, 'password') : undefined
          if (champ) {
            setErreurs({ password: champ })
            setTentative((n) => n + 1)
          } else setMessage(err.message)
        },
      },
    )
  }

  if (!token) {
    return (
      <div className={styles.page}>
        <PageHeader title="Nouveau mot de passe" />
        <Alert>Lien invalide ou expiré.</Alert>
        <p className={styles.links}>
          <Link to="/mot-de-passe-oublie">Demander un nouveau lien (mot de passe oublié)</Link>
        </p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Nouveau mot de passe" />
      {message && <Alert>{message}</Alert>}
      <form noValidate onSubmit={onSubmit} ref={formRef} className={styles.form}>
        <Field label="Nouveau mot de passe" type="password" autoComplete="new-password" hint="10 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} error={erreurs.password} />
        <Field label="Confirmation du mot de passe" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} error={erreurs.confirmation} />
        <Button type="submit" loading={reset.isPending}>Modifier le mot de passe</Button>
      </form>
    </div>
  )
}
