import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { factions } from '../data'
import { DEFAULT_BUDGET, memberName, newId, newMember, type Member } from '../lib/crew'
import { limitLabel } from '../lib/format'
import { saveCrew } from '../lib/storage'
import FactionSeal from '../components/FactionSeal'

export default function NewCrewPage() {
  const navigate = useNavigate()
  const [factionId, setFactionId] = useState('')
  const [name, setName] = useState('')
  const [budget, setBudget] = useState(DEFAULT_BUDGET)
  const [unrestricted, setUnrestricted] = useState(false)
  const [error, setError] = useState('')
  const faction = factions.find((f) => f.id === factionId)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!faction) return
    const now = new Date().toISOString()
    // Le chef et les profils obligatoires sont recrutés d'office.
    const members: Member[] = []
    for (const p of faction.profiles)
      for (let i = 0; i < p.min; i++) members.push(newMember(faction.id, p, members.map(memberName)))
    try {
      const crew = await saveCrew({ id: newId(), name, factionId, budget, unrestricted, members, createdAt: now, updatedAt: now })
      navigate(`/bandes/${crew.id}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (!faction) {
    return (
      <section>
        <div className="step-head">
          <Link to="/bandes" className="back" aria-label="Retour">‹</Link>
          <div>
            <h1>Nouvelle bande</h1>
            <p className="step-sub">Choisir la faction</p>
          </div>
        </div>
        <div className="faction-list">
          {factions.map((f) => (
            <button key={f.id} className="faction-row" onClick={() => setFactionId(f.id)}>
              <FactionSeal id={f.id} name={f.name} size={52} />
              <span className="faction-row-text">
                <strong>{f.name}</strong>
                <span className="muted small">
                  {f.profiles.length} profils · chef à {f.profiles.find((p) => p.role === 'chef')?.cost ?? '?'} PO
                </span>
              </span>
              <span className="chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="step-head">
        <button className="back" onClick={() => setFactionId('')} aria-label="Changer de faction">‹</button>
        <div>
          <h1>Nouvelle bande</h1>
          <p className="step-sub">Nom et budget</p>
        </div>
      </div>

      <div className="new-crew-panel card">
        <form onSubmit={submit} className="stack">
          <div className="row">
            <FactionSeal id={faction.id} name={faction.name} size={56} />
            <h2 className="panel-title">{faction.name}</h2>
          </div>
          <label className="field">
            <span>Nom de la bande</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Les Ramasseurs de Franckie" />
            <small className="muted">Vous pourrez le changer à tout moment.</small>
          </label>
          <label className="field">
            <span>Budget de départ (PO)</span>
            <input type="number" min={0} step={10} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </label>
          <label className="switch">
            <input type="checkbox" checked={unrestricted} onChange={(e) => setUnrestricted(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span>Lever les restrictions</span>
          </label>
          <p className="muted small">
            Sans restrictions, le builder ne bloque plus les effectifs, le budget, les mains ni l'équipement autorisé. Pratique pour les
            bandes maison ou les tests.
          </p>
          {error && <p className="error">{error}</p>}
          <div>
            <button className="btn primary" type="submit">Créer la bande</button>
          </div>
        </form>

        <aside className="panel-side">
          <h3>Profils disponibles</h3>
          <ul className="profile-summary">
            {faction.profiles.map((p) => (
              <li key={p.id}>
                <span><span className="limit">{limitLabel(p)}</span> {p.name}</span>
                <span>{p.cost} PO</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  )
}
