import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'

type Mode = 'login' | 'signup' | 'reset'

export default function LoginPage() {
  const { signIn, signUp, resetPassword, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const go = (m: Mode) => { setMode(m); setError(''); setInfo('') }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (mode === 'signup' && password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') await signIn(email, password)
      else if (mode === 'signup') await signUp(email, password, pseudo)
      else {
        await resetPassword(email)
        setInfo(`Un email pour choisir un nouveau mot de passe vient d'être envoyé à ${email} (pensez aux spams).`)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="login card">
      <h1>Bienvenue, récolteur</h1>
      <p className="muted">Connectez-vous pour retrouver vos bandes sur tous vos appareils.</p>

      {mode !== 'reset' && (
        <div className="segmented login-tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => go('login')}>Se connecter</button>
          <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => go('signup')}>Créer un compte</button>
        </div>
      )}

      <form onSubmit={submit} className="stack">
        {mode === 'signup' && (
          <label className="field">
            <span>Pseudo</span>
            <input required minLength={2} maxLength={24} autoComplete="nickname" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Affiché à la place de votre email" />
          </label>
        )}
        <label className="field">
          <span>Adresse email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" />
        </label>
        {mode !== 'reset' && (
          <label className="field">
            <span>Mot de passe</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {mode === 'signup' && (
          <label className="field">
            <span>Confirmer le mot de passe</span>
            <input type="password" required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir le lien'}
        </button>
        {mode === 'login' && <button type="button" className="link-btn small" onClick={() => go('reset')}>Mot de passe oublié ?</button>}
        {mode === 'reset' && <button type="button" className="link-btn small" onClick={() => go('login')}>← Retour à la connexion</button>}
      </form>

      {info && <p className="notice">{info}</p>}
      {error && <p className="error">{error}</p>}

      {mode !== 'reset' && (
        <>
          <div className="divider"><span>ou</span></div>
          <button className="btn" onClick={() => signInWithGoogle().catch((err) => setError(err.message))}>
            Continuer avec Google
          </button>
        </>
      )}
    </section>
  )
}
