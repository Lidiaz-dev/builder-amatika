import { crystalWord } from '../lib/crew'
import { useState } from 'react'
import { listAllGifts, type Entry, type Gift, type GroupCampaign } from '../lib/groupCampaign'

/**
 * Maître de campagne : tous les envois de la campagne, avec leur état. Un envoi pas encore ajouté
 * l'est dès que son destinataire ouvre sa bande (sauf ceux qui attendent la clôture de leur journée).
 */
export default function AllGiftsPanel({ campaign, entries }: { campaign: GroupCampaign; entries: Entry[] }) {
  const [gifts, setGifts] = useState<Gift[] | null>(null)
  const [error, setError] = useState('')
  const load = () => {
    setError('')
    listAllGifts(campaign.id).then(setGifts).catch((e) => setError((e as Error).message))
  }
  const who = (email: string) => entries.find((e) => e.email === email)
  const reason = (g: Gift) => {
    if (g.claimed) return '✓ Ajouté à sa bande'
    const e = who(g.to)
    if (!e) return "Le destinataire n'est plus dans la campagne"
    if (!e.crewId) return "Le destinataire n'a pas de bande"
    if (!e.ready) return "Sa bande n'est pas encore validée pour la campagne"
    return "Pas encore ajouté : il n'a pas rouvert sa bande depuis"
  }
  const content = (g: Gift) =>
    [g.po ? `${g.po} PO` : '', g.cristaux ? `${g.cristaux} ${crystalWord(g.cristaux)}` : '', ...g.items.map((i) => i.name), ...(g.xp ?? []).map((x) => `${x.name} +${x.amount} XP`), ...(g.remove ?? []).map((r) => `retirer ${r.name}`)]
      .filter(Boolean)
      .join(', ') || 'rien'

  return (
    <details className="card all-gifts" onToggle={(e) => (e.target as HTMLDetailsElement).open && gifts === null && load()}>
      <summary><h2>Tous les envois</h2></summary>
      <p className="muted small">Pour vérifier qu'un envoi est bien arrivé. Un envoi « pas encore ajouté » l'est dès que le destinataire ouvre sa bande.</p>
      <button className="link-btn small" onClick={load}>↻ Actualiser</button>
      {error && <p className="error small">{error}</p>}
      {!error && gifts === null && <p className="muted small">Chargement…</p>}
      {gifts?.length === 0 && <p className="muted small">Aucun envoi pour l'instant.</p>}
      {gifts && gifts.length > 0 && (
        <ul className="plain-list all-gifts-list">
          {gifts.map((g) => (
            <li key={g.id} className={g.claimed ? '' : 'pending'}>
              <div className="row wrap between">
                <span><strong>{g.fromName}</strong> → <strong>{g.toName}</strong> <span className="muted small">· {new Date(g.createdAt).toLocaleDateString('fr-FR')} · journée {g.day}</span></span>
                <span className={`badge ${g.claimed ? 'ok' : ''}`}>{reason(g)}</span>
              </div>
              <span className="small">{content(g)}</span>
              {g.message && <em className="gift-message small"> « {g.message} »</em>}
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
