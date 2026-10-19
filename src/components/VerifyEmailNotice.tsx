import { useState } from 'react'
import { sendEmailVerification } from 'firebase/auth'
import { useAuth } from '../lib/auth'

/**
 * Les campagnes identifient les joueurs par leur email : il doit être vérifié. Les comptes Google
 * le sont d'office ; avec un mot de passe, il faut cliquer sur le lien reçu par email.
 */
export default function VerifyEmailNotice() {
  const { user } = useAuth()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  if (!user || user.emailVerified) return null

  async function send() {
    setError('')
    try {
      await sendEmailVerification(user!)
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function refresh() {
    await user!.reload()
    await user!.getIdToken(true)
    window.location.reload()
  }

  return (
    <div className="notice verify-email">
      <p>
        Pour accéder aux campagnes, votre adresse <strong>{user.email}</strong> doit être vérifiée.
        {sent && ' Un email de vérification vient d’être envoyé (pensez aux spams) : cliquez sur son lien, puis revenez ici.'}
      </p>
      <div className="row wrap">
        <button className="btn small" onClick={send} disabled={sent}>Envoyer l'email de vérification</button>
        <button className="btn small primary" onClick={refresh}>J'ai vérifié mon adresse</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
