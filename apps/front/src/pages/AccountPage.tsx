import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FlashMessage } from '../app/FlashMessage'
import { api } from '../lib/api'
import { useMe } from '../lib/auth'
import { Alert, Button, Field, Modal, PageHeader } from '../ui'
import styles from './AccountPage.module.css'
import { useEnvoiUnique } from './useEnvoiUnique'

const ROLES = { user: 'Utilisateur', admin: 'Administrateur' } as const

function telecharger(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = 'digimmo-export.json'
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  URL.revokeObjectURL(url)
}

export function AccountPage() {
  const me = useMe().data
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const envoi = useEnvoiUnique()
  const [ouvert, setOuvert] = useState(false)
  const [motDePasse, setMotDePasse] = useState('')
  const [erreurLocale, setErreurLocale] = useState<string>()

  const exporter = useMutation({
    mutationFn: async () => telecharger(await api<unknown>('/me/export')),
  })
  const suppression = useMutation({
    mutationFn: (password: string) => api<void>('/me', { method: 'DELETE', body: { password } }),
    onSuccess: () => {
      queryClient.clear()
      void navigate('/', { replace: true, state: { flash: 'Votre compte a été supprimé.' } })
    },
    onSettled: () => envoi.liberer(),
  })

  const fermer = () => {
    setOuvert(false)
    setMotDePasse('')
    setErreurLocale(undefined)
    suppression.reset()
  }
  const confirmer = () => {
    if (envoi.occupe()) return
    if (!motDePasse) {
      setErreurLocale('Saisissez votre mot de passe.')
      return
    }
    setErreurLocale(undefined)
    envoi.prendre()
    suppression.mutate(motDePasse)
  }

  return (
    <div>
      <FlashMessage />
      <PageHeader title="Mon compte" />
      {me && (
        <dl className={styles.infos}>
          <dt>E-mail</dt>
          <dd>{me.email}</dd>
          <dt>Rôle</dt>
          <dd>{ROLES[me.role]}</dd>
        </dl>
      )}
      {exporter.error && <Alert>{exporter.error.message}</Alert>}
      <div className={styles.actions}>
        <Button variant="secondary" loading={exporter.isPending} onClick={() => exporter.mutate()}>
          Exporter mes données
        </Button>
        <Button variant="danger" onClick={() => setOuvert(true)}>Supprimer mon compte</Button>
      </div>
      <Modal
        open={ouvert}
        title="Supprimer mon compte"
        onClose={fermer}
        footer={
          <>
            <Button variant="secondary" onClick={fermer}>Annuler</Button>
            <Button variant="danger" loading={suppression.isPending} onClick={confirmer}>Supprimer définitivement</Button>
          </>
        }
      >
        <p>Vos projets et vos plans seront définitivement supprimés.</p>
        <Field
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          value={motDePasse}
          error={erreurLocale}
          onChange={(e) => setMotDePasse(e.target.value)}
        />
        {suppression.error && <Alert>{suppression.error.message}</Alert>}
      </Modal>
    </div>
  )
}
