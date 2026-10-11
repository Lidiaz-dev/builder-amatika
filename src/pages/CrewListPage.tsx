import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { factionById, factions } from '../data'
import { useAuth } from '../lib/auth'
import { crewCost, newId, phaseOf, PHASE_LABELS, type Crew } from '../lib/crew'
import { readCrewFile } from '../lib/crewFile'
import { listCrews, saveCrew } from '../lib/storage'
import { isLegal, validateCrew } from '../lib/validate'
import FactionSeal from '../components/FactionSeal'

type Sort = 'recent' | 'name' | 'faction'

export default function CrewListPage() {
  const { localMode } = useAuth()
  const [crews, setCrews] = useState<Crew[] | null>(null)
  const [error, setError] = useState('')
  const [faction, setFaction] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const fileInput = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const navigate = useNavigate()

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setImporting(true)
    try {
      const read = await readCrewFile(file)
      const existing = crews?.find((c) => c.id === read.id)
      let crew: Crew
      if (!existing) crew = { ...read, id: newId() }
      else if (confirm(`La bande « ${existing.name || 'sans nom'} » existe déjà.

OK : la remplacer par la version du fichier.
Annuler : l'importer comme une nouvelle bande.`)) crew = read
      else crew = { ...read, id: newId(), name: `${read.name || 'Bande'} (copie)` }
      const saved = await saveCrew(crew)
      navigate(`/bandes/${saved.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setImporting(false)
    }
  }

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
        <div className="row wrap">
          <button className="btn" onClick={() => fileInput.current?.click()} disabled={importing} title="Importer une bande depuis le PDF de ses fiches">
            {importing ? 'Import…' : '⬆ Importer une bande'}
          </button>
          <input ref={fileInput} type="file" accept=".pdf,.json,application/pdf,application/json" onChange={importFile} hidden />
          <Link to="/bandes/nouvelle" className="btn primary">+ Nouvelle bande</Link>
        </div>
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
            <p className="small">Pour passer une bande sur un autre appareil : téléchargez le PDF de ses fiches, puis « Importer une bande » sur l'autre appareil.</p>
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
