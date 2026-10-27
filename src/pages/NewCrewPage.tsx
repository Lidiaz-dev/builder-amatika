import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { factions } from '../data'
import { DEFAULT_BUDGET, memberName, newId, newMember, welcomeOnCreate, type Member } from '../lib/crew'
import { limitLabel } from '../lib/format'
import { getCrew, saveCrew } from '../lib/storage'
import { getCampaign, getMyEntry, registerCrew, type Entry, type GroupCampaign } from '../lib/groupCampaign'
import FactionSeal from '../components/FactionSeal'

export default function NewCrewPage() {
  const navigate = useNavigate()
  const [factionId, setFactionId] = useState('')
  const [name, setName] = useState('')
  const [budget, setBudget] = useState(DEFAULT_BUDGET)
  const [unrestricted, setUnrestricted] = useState(false)
  const [error, setError] = useState('')
  const faction = factions.find((f) => f.id === factionId)

  // Bande créée pour une campagne de groupe (?campagne=…) : elle y est inscrite dès sa création.
  const [params] = useSearchParams()
  const campaignId = params.get('campagne')
  const [campaign, setCampaign] = useState<GroupCampaign | null>(null)
  const [entry, setEntry] = useState<Entry | null>(null)
  useEffect(() => {
    if (!campaignId) return
    getCampaign(campaignId).then(setCampaign).catch(() => setCampaign(null))
    getMyEntry(campaignId).then(setEntry).catch(() => setEntry(null))
  }, [campaignId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!faction) return
    const now = new Date().toISOString()
    // Le chef et les profils obligatoires sont recrutés d'office.
    const members: Member[] = []
    for (const p of faction.profiles)
      for (let i = 0; i < p.min; i++) members.push(newMember(faction.id, p, members.map(memberName)))
    try {
      const crew = await saveCrew({
        id: newId(),
        name,
        factionId,
        budget,
        unrestricted: campaign ? false : unrestricted,
        members,
        createdAt: now,
        updatedAt: now,
        ...(campaign ? { groupCampaign: { id: campaign.id, name: campaign.name } } : {}),
      })
      if (campaign) {
        await registerCrew(campaign.id, crew)
        // Reroll : l'ancienne bande quitte la campagne mais reste dans « Mes bandes ».
        if (entry?.crewId && entry.crewId !== crew.id) {
          const previous = await getCrew(entry.crewId).catch(() => null)
          if (previous) await saveCrew({ ...previous, groupCampaign: undefined })
        }
      }
      navigate(`/bandes/${crew.id}`, { state: { welcome: welcomeOnCreate(factionId, name) } })
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
        {campaign && <CampaignNotice campaign={campaign} reroll={!!entry?.crewId} />}
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
      {campaign && <CampaignNotice campaign={campaign} reroll={!!entry?.crewId} />}

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
          {!campaign && (
            <>
          <label className="switch">
            <input type="checkbox" checked={unrestricted} onChange={(e) => setUnrestricted(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span>Lever les restrictions</span>
          </label>
          <p className="muted small">
            Sans restrictions, le builder ne bloque plus les effectifs, le budget, les mains ni l'équipement autorisé. Pratique pour les
            bandes maison ou les tests.
          </p>
            </>
          )}
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

function CampaignNotice({ campaign, reroll }: { campaign: GroupCampaign; reroll: boolean }) {
  return (
    <p className="notice">
      Bande pour la campagne <strong>{campaign.name}</strong> : elle y sera inscrite dès sa création.
      {reroll && ' Votre bande actuelle quittera la campagne (elle reste dans « Mes bandes »).'}
    </p>
  )
}
