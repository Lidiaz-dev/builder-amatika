import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { factionById, injuryById, spellById } from '../data'
import { actionsOf, effectiveStats, emptyStock, isActive, lootItems, memberName, memberSkills, profileOf, wornItems, bagItems, type Crew } from '../lib/crew'
import { getCampaign, type GroupCampaign } from '../lib/groupCampaign'
import { getCrew } from '../lib/storage'
import StatLine from '../components/StatLine'
import SkillTag from '../components/SkillTag'
import ItemChip from '../components/ItemChip'
import FactionSeal from '../components/FactionSeal'

/**
 * Consultation d'une bande d'une campagne, sans rien pouvoir modifier : trésor, membres
 * (caractéristiques, compétences, équipement, blessures) et coffre du camp.
 */
export default function CrewViewPage() {
  const { campaignId, id } = useParams()
  const [crew, setCrew] = useState<Crew | null | undefined>(undefined)
  const [campaign, setCampaign] = useState<GroupCampaign | null>(null)

  useEffect(() => {
    getCrew(id!).then(setCrew).catch(() => setCrew(null))
    getCampaign(campaignId!).then(setCampaign).catch(() => setCampaign(null))
  }, [id, campaignId])

  const back = (
    <nav className="crumbs">
      <Link to="/campagnes">Campagnes</Link> <span>›</span> <Link to={`/campagnes/${campaignId}`}>{campaign?.name ?? 'Campagne'}</Link> <span>›</span> {crew?.name || 'Bande'}
    </nav>
  )
  if (crew === undefined) return <p className="muted">Chargement…</p>
  const faction = crew ? factionById(crew.factionId) : undefined
  if (!crew || !faction) {
    return (
      <section>
        {back}
        <p className="error">Bande introuvable, ou vous n'avez pas le droit de la consulter.</p>
      </section>
    )
  }

  const c = crew.campaign
  const stock = c?.stock ?? emptyStock()
  const members = crew.members.filter(isActive)

  return (
    <section className="crew-view">
      {back}
      <div className="page-head">
        <div className="row">
          <FactionSeal id={faction.id} name={faction.name} size={52} />
          <div>
            <h1>{crew.name || 'Bande sans nom'}</h1>
            <p className="muted">{faction.name} · consultation seule</p>
          </div>
        </div>
      </div>

      {c ? (
        <p className="crew-view-totals">
          <span><strong>{c.po}</strong> PO</span>
          <span><strong>{c.cristaux}</strong> cristaux</span>
          <span><strong>{c.prestige}</strong> prestige</span>
          <span><strong>{members.length}</strong> membres</span>
          <span><strong>{c.games.length}</strong> partie{c.games.length > 1 ? 's' : ''}</span>
        </p>
      ) : (
        <p className="notice small">Bande en construction : elle n'est pas encore validée pour la campagne.</p>
      )}

      <div className="crew-view-grid">
        {members.map((m) => {
          const p = profileOf(faction, m)
          if (!p) return null
          const loot = lootItems(m)
          const worn = [...wornItems(m).map((e) => ({ key: `e${e.id}`, el: <ItemChip equipmentId={e.id} /> })), ...loot.filter((l) => l.ref.slot === 'porte').map((l) => ({ key: l.ref.id, el: <ItemChip lootKey={l.ref.key} /> }))]
          const bag = [...bagItems(m).map((e) => ({ key: `s${e.id}`, el: <ItemChip equipmentId={e.id} /> })), ...loot.filter((l) => l.ref.slot === 'sac').map((l) => ({ key: l.ref.id, el: <ItemChip lootKey={l.ref.key} /> }))]
          const spells = (m.spellIds ?? []).map((sid) => spellById(sid)?.name).filter(Boolean)
          return (
            <article key={m.id} className="unit-card">
              <header className="unit-band">
                <h3>{memberName(m) || p.name}</h3>
                <span className="unit-role">{p.name}{c ? ` · niv. ${m.level} · ${m.xp} XP · ${actionsOf(m)} actions` : ''}</span>
              </header>
              <div className="unit-body">
                <StatLine stats={effectiveStats(p, m)} base={p.stats} />
                <div className="tags">{memberSkills(p, m).map((s) => <SkillTag key={s} name={s} />)}</div>
                <dl className="crew-view-items">
                  <dt>Porté</dt>
                  <dd>{worn.length ? <span className="tags">{worn.map((w, i) => <span key={`${w.key}${i}`}>{w.el}</span>)}</span> : <span className="muted small">Mains nues</span>}</dd>
                  {bag.length > 0 && (
                    <>
                      <dt>Sac</dt>
                      <dd><span className="tags">{bag.map((w, i) => <span key={`${w.key}${i}`}>{w.el}</span>)}</span></dd>
                    </>
                  )}
                  {spells.length > 0 && (
                    <>
                      <dt>Sorts</dt>
                      <dd className="small">{spells.join(', ')}</dd>
                    </>
                  )}
                  {(m.advances ?? []).length > 0 && (
                    <>
                      <dt>Progression</dt>
                      <dd>
                        <ul className="crew-view-advances small">
                          {(m.advances ?? []).map((a) => (
                            <li key={a.id}>
                              <strong>Niv. {a.level}</strong> : {a.label}
                              {a.spellId ? ` · nouveau sort : ${spellById(a.spellId)?.name ?? a.spellId}` : ''}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  )}
                  {(m.injuries ?? []).length > 0 && (
                    <>
                      <dt>Blessures</dt>
                      <dd className="small">{(m.injuries ?? []).map((r) => injuryById(r.cardId)?.name ?? r.cardId).join(', ')}</dd>
                    </>
                  )}
                </dl>
              </div>
            </article>
          )
        })}
      </div>

      {c && (
        <section className="card crew-view-stock">
          <h2>Coffre du camp <span className="muted small">({stock.equipment.length + stock.loot.length})</span></h2>
          {stock.equipment.length + stock.loot.length === 0 ? (
            <p className="muted small">Vide.</p>
          ) : (
            <span className="tags">
              {stock.equipment.map((eid, i) => <ItemChip key={`e${i}`} equipmentId={eid} />)}
              {stock.loot.map((l) => <ItemChip key={l.id} lootKey={l.key} />)}
            </span>
          )}
        </section>
      )}
    </section>
  )
}
