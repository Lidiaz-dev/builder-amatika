import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { PSEUDO_MAX } from '../lib/profile'

/** Choix (première connexion) ou modification du pseudo affiché à la place de l'email. */
export default function PseudoPage({ edit = false }: { edit?: boolean }) {
  const { user, pseudo, setPseudo } = useAuth()
  const suggestion = pseudo ?? user?.displayName ?? (user?.email ?? '').split('@')[0]
  const [value, setValue] = useState(suggestion.slice(0, PSEUDO_MAX))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await setPseudo(value)
      // Première connexion : le site s'affiche dès que le pseudo est connu.
      if (edit) setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="login card">
      <h1>{edit ? 'Mon pseudo' : 'Choisissez votre pseudo'}</h1>
      <p className="muted">
        {edit
          ? 'Le pseudo est affiché à la place de votre adresse email, notamment dans les campagnes.'
          : "Il sera affiché à la place de votre adresse email, notamment dans les campagnes. Vous pourrez le changer plus tard."}
      </p>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Pseudo</span>
          <input autoFocus required minLength={2} maxLength={PSEUDO_MAX} value={value} onChange={(e) => { setValue(e.target.value); setDone(false) }} />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? '…' : edit ? 'Enregistrer' : 'Valider mon pseudo'}</button>
      </form>
      {done && <p className="notice ok">✓ Pseudo enregistré.</p>}
      {error && <p className="error">{error}</p>}
      {edit && user?.email && <p className="muted small">Compte : {user.email}</p>}
    </section>
  )
}
