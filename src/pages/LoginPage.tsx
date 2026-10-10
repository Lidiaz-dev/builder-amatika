import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const { signInWithEmail, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signInWithEmail(email)
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="login card">
      <h1>Bienvenue, récolteur</h1>
      <p className="muted">Connectez-vous pour créer et retrouver vos bandes.</p>
      {sent ? (
        <p className="notice">Un lien de connexion vient d'être envoyé à <strong>{email}</strong>. Ouvrez-le depuis ce navigateur.</p>
      ) : (
        <form onSubmit={submit} className="stack">
          <label className="field">
            <span>Adresse email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" />
          </label>
          <button className="btn primary" type="submit">Recevoir un lien de connexion</button>
        </form>
      )}
      <div className="divider"><span>ou</span></div>
      <button className="btn" onClick={() => signInWithGoogle().catch((err) => setError(err.message))}>
        Continuer avec Google
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
