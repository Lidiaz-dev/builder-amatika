import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { factionById, factions } from '../data'
import { useAuth } from '../lib/auth'
import { crewCost, newId, type Crew } from '../lib/crew'
import { readCrewFile } from '../lib/crewFile'
import { crewDayState } from '../lib/groupCampaign'
import { listCrews, localCrews, moveLocalCrewsToAccount, saveCrew } from '../lib/storage'
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
  // Bandes créées dans ce navigateur avant la connexion : on propose de les rattacher au compte.
  const [pendingLocal, setPendingLocal] = useState(() => localCrews().length)
  const [moving, setMoving] = useState(false)

  async function moveLocal() {
    setMoving(true)
    setError('')
    try {
      await moveLocalCrewsToAccount()
      setPendingLocal(0)
      setCrews(await listCrews())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setMoving(false)
    }
  }

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

  // Statut des bandes inscrites à une campagne de groupe (journée en cours, feuille à remplir…).
  const [campaignBadges, setCampaignBadges] = useState<Record<string, { campaign: string; day?: string }>>({})
  useEffect(() => {
    const linked = (crews ?? []).filter((c) => c.groupCampaign)
    if (!linked.length) return
    Promise.all(
      linked.map(async (c) => {
        const st = await crewDayState(c).catch(() => null)
        // Bande remplacée (reroll) ou joueur retiré : plus d'indicateur.
        if (!st) return null
        const day = !st.participant || !st.day ? undefined
          : st.day.status === 'preparation' ? `Journée ${st.day.number} : préparation`
          : st.day.status === 'en-cours' ? `⚔ Journée ${st.day.number}`
          : st.sheet ? `Journée ${st.day.number} : rapport validé` : `☾ Journée ${st.day.number} : rapport à faire`
        return [c.id, { campaign: st.campaign.name, day }] as const
      }),
    ).then((rows) => setCampaignBadges(Object.fromEntries(rows.filter((r) => !!r) as [string, { campaign: string; day?: string }][])))
  }, [crews])

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

      {pendingLocal > 0 && (
        <div className="notice local-move">
          <span>
            {pendingLocal} bande{pendingLocal > 1 ? 's' : ''} enregistrée{pendingLocal > 1 ? 's' : ''} dans ce navigateur avant la connexion.
            Rattachez-les à votre compte pour les retrouver partout.
          </span>
          <button className="btn small primary" onClick={moveLocal} disabled={moving}>
            {moving ? 'Transfert…' : 'Ajouter à mon compte'}
          </button>
        </div>
      )}
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
                {campaignBadges[c.id] && <span className="badge campaign-badge" data-tip={`Bande inscrite à la campagne « ${campaignBadges[c.id].campaign} »`}>⚑ {campaignBadges[c.id].campaign}</span>}
                {campaignBadges[c.id]?.day && <span className="badge phase-badge phase-partie">{campaignBadges[c.id].day}</span>}
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
