import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { factionById, factions } from '../data'
import { useAuth } from '../lib/auth'
import { crewCost, phaseOf, PHASE_LABELS, type Crew } from '../lib/crew'
import { listCrews } from '../lib/storage'
import { isLegal, validateCrew } from '../lib/validate'
import FactionSeal from '../components/FactionSeal'

type Sort = 'recent' | 'name' | 'faction'

export default function CrewListPage() {
  const { localMode } = useAuth()
  const [crews, setCrews] = useState<Crew[] | null>(null)
  const [error, setError] = useState('')
  const [faction, setFaction] = useState('')
  const [sort, setSort] = useState<Sort>('recent')

  useEffect(() => {
    listCrews().then(setCrews).catch((e) => setError(e.message))
  }, [])

  const shown = useMemo(() => {
    const list = (crews ?? []).filter((c) => !faction || c.factionId === faction)
    const factionName = (c: Crew) => factionById(c.factionId)?.name ?? ''
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'faction') list.sort((a, b) => factionName(a).localeCompare(factionName(b)))
    return list
  }, [crews, faction, sort])

  const usedFactions = factions.filter((f) => crews?.some((c) => c.factionId === f.id))

  return (
    <section>
      <div className="page-head">
        <h1>Mes bandes</h1>
        <Link to="/bandes/nouvelle" className="btn primary">+ Nouvelle bande</Link>
      </div>

      <div className="filter-bar">
        <button className={`chip ${faction === '' ? 'on' : ''}`} onClick={() => setFaction('')}>Toutes</button>
        <select value={faction} onChange={(e) => setFaction(e.target.value)} aria-label="Filtrer par faction">
          <option value="">Faction</option>
          {usedFactions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select className="push-right" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Trier">
          <option value="recent">Plus récentes</option>
          <option value="name">Par nom</option>
          <option value="faction">Par faction</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {crews === null && !error && <p className="muted">Chargement…</p>}

      <div className="crew-grid">
        {localMode && (
          <div className="card info-card">
            <h2>Mode local</h2>
            <p>Les comptes ne sont pas encore branchés : vos bandes sont enregistrées dans ce navigateur uniquement.</p>
          </div>
        )}
        {shown.map((c) => {
          const f = factionById(c.factionId)
          const legal = isLegal(validateCrew(c))
          return (
            <Link key={c.id} to={`/bandes/${c.id}`} className="crew-tile card">
              <FactionSeal id={c.factionId} name={f?.name ?? '?'} />
              <div className="crew-tile-text">
                <strong>{c.name || 'Bande sans nom'}</strong>
                <span className="muted">{f?.name ?? c.factionId}</span>
                <span className="small">
                  {c.members.length} membre{c.members.length > 1 ? 's' : ''} ·{' '}
                  {c.campaign ? `${c.campaign.po} PO · ${c.campaign.games.length} partie${c.campaign.games.length > 1 ? 's' : ''}` : `${crewCost(c)} / ${c.budget} PO`}
                </span>
              </div>
              <span className="crew-tile-badges">
                <span className={`badge phase-badge phase-${phaseOf(c)}`}>{phaseOf(c) === 'partie' ? '⚔ ' : ''}{PHASE_LABELS[phaseOf(c)]}</span>
                <span className={`badge ${legal ? 'ok' : 'ko'}`}>{c.unrestricted ? 'Libre' : legal ? 'Valide' : 'À corriger'}</span>
              </span>
            </Link>
          )
        })}
        <Link to="/bandes/nouvelle" className="new-tile">+ Nouvelle bande</Link>
      </div>
    </section>
  )
}
