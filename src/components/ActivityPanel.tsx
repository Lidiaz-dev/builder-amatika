import { useState } from 'react'
import type { Crew } from '../lib/crew'
import type { Entry } from '../lib/groupCampaign'
import { getCrew } from '../lib/storage'

/**
 * Maître de campagne : journal d'activité des joueurs sur leurs bandes (objets déplacés, achats,
 * ventes, recrutements, niveaux…), du plus récent au plus ancien, filtrable par joueur.
 */
export default function ActivityPanel({ entries }: { entries: Entry[] }) {
  const players = entries.filter((e) => e.crewId)
  const [crews, setCrews] = useState<Crew[] | null>(null)
  const [who, setWho] = useState('')
  const [limit, setLimit] = useState(60)
  const [error, setError] = useState('')
  const load = () => {
    setError('')
    Promise.all(players.map((p) => getCrew(p.crewId!).catch(() => null)))
      .then((all) => setCrews(all.filter((c): c is Crew => !!c)))
      .catch((e) => setError((e as Error).message))
  }
  const owner = (crew: Crew) => players.find((p) => p.crewId === crew.id)
  const rows = (crews ?? [])
    .filter((c) => !who || owner(c)?.email === who)
    .flatMap((c) => (c.activity ?? []).map((a) => ({ ...a, crew: c.name || 'Bande sans nom', player: owner(c)?.pseudo || '' })))
    .sort((a, b) => b.at.localeCompare(a.at))

  return (
    <details className="card activity-panel" onToggle={(e) => (e.target as HTMLDetailsElement).open && crews === null && load()}>
      <summary><h2>Activité des joueurs</h2></summary>
      <p className="muted small">
        Ce que chaque joueur a fait sur sa bande : objets déplacés (personnage ↔ coffre), reçus ou retirés, achats et ventes, recrutements,
        départs, montées de niveau… Le rapport d'après-bataille est résumé en une ligne (son détail est dans « Journées »).
      </p>
      <div className="row wrap">
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filtrer par joueur">
          <option value="">Tous les joueurs</option>
          {players.map((p) => <option key={p.email} value={p.email}>{p.pseudo || p.email} · {p.crewName}</option>)}
        </select>
        <button className="link-btn small" onClick={load}>↻ Actualiser</button>
      </div>
      {error && <p className="error small">{error}</p>}
      {!error && crews === null && <p className="muted small">Chargement…</p>}
      {crews && rows.length === 0 && <p className="muted small">Aucune activité notée pour l'instant.</p>}
      {rows.length > 0 && (
        <ul className="plain-list activity-list">
          {rows.slice(0, limit).map((r, i) => (
            <li key={i}>
              <span className="activity-when muted small">{new Date(r.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {!who && <strong className="activity-who">{r.player || r.crew}</strong>}
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > limit && <button className="link-btn small" onClick={() => setLimit((l) => l + 100)}>Voir plus ({rows.length - limit} de plus)</button>}
    </details>
  )
}
