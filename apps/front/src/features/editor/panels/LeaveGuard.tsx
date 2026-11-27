import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router'
import { Button, Modal } from '../../../ui'

type Props = { dirty: boolean; saving: boolean; saveNow: () => Promise<boolean> }

/** Garde de sortie : navigation interne (modale) et fermeture d'onglet (beforeunload). */
export function LeaveGuard({ dirty, saving, saveNow }: Props) {
  const actif = dirty || saving
  // La redirection de session expirée vers /connexion ne doit jamais être bloquée.
  const blocker = useBlocker(({ nextLocation }) => actif && nextLocation.pathname !== '/connexion')
  const [echec, setEchec] = useState(false)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const bloque = blocker.state === 'blocked'
  const enregistrerEtQuitter = async () => {
    setEchec(false)
    if (await saveNow()) blocker.proceed?.()
    else setEchec(true)
  }
  const rester = () => { setEchec(false); blocker.reset?.() }

  return (
    <Modal
      open={bloque}
      title="Des modifications ne sont pas enregistrées."
      onClose={rester}
      footer={
        <>
          <Button variant="secondary" onClick={rester}>Rester</Button>
          <Button variant="danger" onClick={() => blocker.proceed?.()}>Quitter sans enregistrer</Button>
          <Button onClick={() => void enregistrerEtQuitter()}>Enregistrer et quitter</Button>
        </>
      }
    >
      <p>{echec ? "L'enregistrement a échoué : le plan n'a pas été enregistré." : 'Voulez-vous enregistrer le plan avant de quitter ?'}</p>
    </Modal>
  )
}
