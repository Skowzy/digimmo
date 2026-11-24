import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError, issuesFor } from '../lib/api'
import { Alert, Button, Field, PageHeader } from '../ui'
import styles from './AuthPage.module.css'
import { useEnvoiUnique } from './useEnvoiUnique'
import { useFocusInvalide } from './useFocusInvalide'
import { useTitrePage } from '../app/useTitrePage'

export function ForgotPasswordPage() {
  useTitrePage('Mot de passe oublié')
  const [email, setEmail] = useState('')
  const [erreur, setErreur] = useState<string | undefined>()
  const [message, setMessage] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [tentative, setTentative] = useState(0)
  const formRef = useFocusInvalide(tentative)
  const verrou = useEnvoiUnique()
  const envoi = useMutation({
    mutationFn: (adresse: string) =>
      api<{ message: string }>('/auth/password/forgot', { method: 'POST', body: { email: adresse } }),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (verrou.occupe()) return
    setMessage(null)
    if (!email.trim()) {
      setErreur('Saisissez votre adresse e-mail.')
      setTentative((n) => n + 1)
      return
    }
    setErreur(undefined)
    verrou.prendre()
    envoi.mutate(email.trim(), {
      onSettled: verrou.liberer,
      onSuccess: (data) => setConfirmation(data.message),
      onError: (err) => {
        const champ = err instanceof ApiError ? issuesFor(err.issues, 'email') : undefined
        if (champ) {
          setErreur(champ)
          setTentative((n) => n + 1)
        } else setMessage(err.message)
      },
    })
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Mot de passe oublié" />
      {confirmation ? (
        <Alert tone="success">{confirmation}</Alert>
      ) : (
        <>
          {message && <Alert>{message}</Alert>}
          <form noValidate onSubmit={onSubmit} ref={formRef} className={styles.form}>
            <Field label="Adresse e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={erreur} />
            <Button type="submit" loading={envoi.isPending}>Envoyer le lien</Button>
          </form>
        </>
      )}
      <p className={styles.links}>
        <Link to="/connexion">Retour à la connexion</Link>
      </p>
    </div>
  )
}
