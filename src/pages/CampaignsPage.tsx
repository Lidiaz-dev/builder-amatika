import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { createCampaign, DAY_STATUS_LABELS, isAdmin, listCampaigns, type GroupCampaign } from '../lib/groupCampaign'
import VerifyEmailNotice from '../components/VerifyEmailNotice'
import { DEFAULT_BUDGET } from '../lib/crew'

/** Liste des campagnes de groupe : toutes pour l'organisateur, celles où l'on est inscrit sinon. */
export default function CampaignsPage() {
  const { user, localMode } = useAuth()
  const [campaigns, setCampaigns] = useState<GroupCampaign[] | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [budget, setBudget] = useState(DEFAULT_BUDGET)
  const navigate = useNavigate()
  const admin = isAdmin(user)

  useEffect(() => {
    if (!user || !user.emailVerified) return
    listCampaigns(user).then(setCampaigns).catch((e) => setError(e.message))
  }, [user])

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || budget <= 0) return
    try {
      const id = await createCampaign(name, budget)
      navigate(`/campagnes/${id}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (localMode) {
    return (
      <section>
        <h1>Campagnes</h1>
        <p className="notice">Les campagnes de groupe nécessitent les comptes : elles seront disponibles une fois Firebase branché.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <h1>Campagnes</h1>
      </div>
      <VerifyEmailNotice />
      {admin && (
        <form className="card row wrap campaign-create" onSubmit={create}>
          <label className="field grow">
            <span>Nouvelle campagne</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : La ruée vers Amatika" />
          </label>
          <label className="field narrow">
            <span>Budget des bandes (PO)</span>
            <input type="number" min={10} step={10} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </label>
          <button className="btn primary" type="submit" disabled={!name.trim() || budget <= 0}>Créer la campagne</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      {user?.emailVerified && campaigns === null && !error && <p className="muted">Chargement…</p>}
      {campaigns?.length === 0 && (
        <p className="muted">{admin ? 'Aucune campagne pour le moment.' : "Vous n'êtes inscrit à aucune campagne. L'organisateur doit vous y ajouter avec votre adresse email."}</p>
      )}
      <div className="crew-grid">
        {campaigns?.map((c) => (
          <Link key={c.id} to={`/campagnes/${c.id}`} className="crew-tile card">
            <div className="crew-tile-text">
              <strong>{c.name}</strong>
              <span className="muted small">{c.emails.length} joueur{c.emails.length > 1 ? 's' : ''} · {c.budget ?? DEFAULT_BUDGET} PO</span>
              <span className="small">{c.dayNumber ? `Journée ${c.dayNumber} : ${DAY_STATUS_LABELS[c.dayStatus ?? 'cloturee']}` : 'Aucune journée jouée'}</span>
            </div>
            {c.dayStatus && c.dayStatus !== 'cloturee' && <span className="badge phase-badge phase-partie">Journée {c.dayNumber}</span>}
          </Link>
        ))}
      </div>
    </section>
  )
}
