import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CATEGORY_LABELS,
  equipment,
  factionById,
  injuryById,
  itemByKey,
  ROLE_LABELS,
  spellById,
  spellsFor,
  TREE_LABELS,
  type Faction,
  type Profile,
  type Spell,
  racialItemsOf,
  baseSpellCount,
  choosesSecondSpell,
} from '../data'
import {
  actionsOf,
  crewCost,
  crewUpkeep,
  CRYSTAL_PRICE,
  effectiveStats,
  isActive,
  isChef,
  isMage,
  lootItems,
  MAX_ON_TABLE,
  memberCost,
  memberSkills,
  memberUpkeep,
  newId,
  memberName,
  newMember,
  phaseOf,
  profileOf,
  withTreasury,
  type Crew,
  type Member,
  type Slot,
  abandonGame,
} from '../lib/crew'
import {
  addXp,
  applyAdvance,
  applyInjury,
  learnsNothing,
  levelForXp,
  nextThreshold,
  pendingLevels,
  revertInjury,
  revertLastAdvance,
} from '../lib/campaign'
import { randomName } from '../lib/names'
import { deleteCrew, getCrew, saveCrew } from '../lib/storage'
import { isLegal, validateCrew, type Issue } from '../lib/validate'
import StatLine from '../components/StatLine'
import SkillTag from '../components/SkillTag'
import FactionSeal from '../components/FactionSeal'
import SpellTag from '../components/SpellTag'
import RarityDot from '../components/RarityDot'
import InfoTag from '../components/InfoTag'
import EquipmentTag from '../components/EquipmentTag'
import { formatMods } from '../lib/format'
import Modal from '../components/Modal'
import InjuryPicker from '../components/InjuryPicker'
import AdvancePicker from '../components/AdvancePicker'
import LootPicker, { type LootPick } from '../components/LootPicker'
import RuleText from '../components/RuleText'
import { crewDayState, lockReason, type CrewDayState } from '../lib/groupCampaign'
import CampaignDayBanner from '../components/CampaignDayBanner'

const SPELL_GROUPS: { label: string; match: (s: Spell) => boolean }[] = [
  { label: 'Sorts de la faction', match: (s) => s.factions.length > 0 && !s.bonus },
  { label: 'Sorts bonus de la faction', match: (s) => s.bonus },
  { label: 'Sorts communs', match: (s) => s.factions.length === 0 },
]

const CONSUMABLE_HINTS = {
  potion: "Bu pendant la partie : l'effet s'applique à la fiche, l'objet sera défaussé après la bataille.",
  poison: 'Arme enduite : jet de réserve de poison après la bataille.',
  single: "Utilisé pendant la partie : l'objet sera défaussé après la bataille.",
} as const

type SaveState = 'saved' | 'pending' | 'saving' | 'error'
type Delta = { po?: number; cristaux?: number; prestige?: number }

export default function CrewBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [crew, setCrew] = useState<Crew | null | undefined>(undefined)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState('')
  const [treasuryOpen, setTreasuryOpen] = useState(false)
  /** Membres recrutés pendant cette visite : leur carte « se pose » à l'apparition. */
  const fresh = useRef(new Set<string>())
  /** Tampon de cire affiché quand la bande devient valide. */
  const [stamp, setStamp] = useState(false)
  const wasLegal = useRef<boolean | null>(null)
  /** Situation de la bande dans sa campagne de groupe (journée en cours, feuille à remplir…). */
  const [dayState, setDayState] = useState<CrewDayState | null | undefined>(undefined)
  const firstLoad = useRef(true)

  useEffect(() => {
    getCrew(id!)
      // Noms proposés jamais modifiés : ils sont affichés comme de vrais noms (ils le deviennent à l'enregistrement).
      .then((c) => setCrew(c && { ...c, members: c.members.map((m) => (!m.name.trim() && m.suggestedName ? { ...m, name: m.suggestedName } : m)) }))
      .catch(() => setCrew(null))
  }, [id])

  const groupId = crew?.groupCampaign?.id
  const crewId = crew?.id
  useEffect(() => {
    if (!groupId || !crewId) {
      setDayState(null)
      return
    }
    crewDayState({ id: crewId, groupCampaign: { id: groupId, name: '' } }).then(setDayState).catch(() => setDayState(null))
  }, [groupId, crewId])

  // Journée annulée (campagne supprimée, bande retirée…) : la partie en cours est abandonnée d'office.
  useEffect(() => {
    if (dayState === undefined || !crew?.groupCampaign || !crew.campaign?.currentGame) return
    if (!dayState?.participant) setCrew((c) => (c ? abandonGame(c) : c))
  }, [dayState, crew])

  // Dernière version de la bande et présence de modifications pas encore enregistrées.
  const latest = useRef<Crew | null>(null)
  const dirty = useRef(false)

  // Sauvegarde automatique, 800 ms après la dernière modification.
  useEffect(() => {
    if (!crew) return
    latest.current = crew
    if (firstLoad.current) {
      firstLoad.current = false
      return
    }
    dirty.current = true
    setSaveState('pending')
    const t = setTimeout(() => {
      setSaveState('saving')
      dirty.current = false
      saveCrew(crew)
        .then(() => {
          setSaveState('saved')
          // Les noms proposés non modifiés sont devenus de vrais noms : on les affiche comme tels.
          if (crew.members.some((m) => !m.name.trim() && m.suggestedName)) {
            setCrew((c) => c && { ...c, members: c.members.map((m) => (!m.name.trim() && m.suggestedName ? { ...m, name: m.suggestedName } : m)) })
          }
        })
        .catch((e) => {
          dirty.current = true
          setSaveError(e.message)
          setSaveState('error')
        })
    }, 800)
    return () => clearTimeout(t)
  }, [crew])

  // En quittant la page (ou l'onglet), on enregistre tout de suite ce qui reste en attente.
  useEffect(() => {
    const flushNow = () => {
      if (dirty.current && latest.current) {
        dirty.current = false
        void saveCrew(latest.current)
      }
    }
    window.addEventListener('beforeunload', flushNow)
    return () => {
      window.removeEventListener('beforeunload', flushNow)
      flushNow()
    }
  }, [])

  /** Enregistre les modifications en attente, puis navigue (évite d'ouvrir une page avec une bande pas à jour). */
  async function saveThenGo(path: string) {
    if (dirty.current && latest.current) {
      dirty.current = false
      setSaveState('saving')
      await saveCrew(latest.current)
      setSaveState('saved')
    }
    navigate(path)
  }

  const faction = crew ? factionById(crew.factionId) : undefined
  const issues = useMemo(() => (crew ? validateCrew(crew) : []), [crew])
  // La bande vient de devenir valide : coup de tampon de cire sur le badge.
  const validNow = crew ? isLegal(issues) && !crew.unrestricted : null
  useEffect(() => {
    if (validNow === null) return
    const before = wasLegal.current
    wasLegal.current = validNow
    if (before === false && validNow) {
      setStamp(true)
      const t = setTimeout(() => setStamp(false), 1700)
      return () => clearTimeout(t)
    }
  }, [validNow])

  if (crew === undefined) return <p className="muted">Chargement…</p>
  if (crew === null || !faction) return <p className="error">Bande introuvable. <Link to="/bandes">Retour</Link></p>

  const campaign = crew.campaign
  const update = (patch: Partial<Crew>) => setCrew({ ...crew, ...patch })
  /** Modifie un membre et, en campagne, le trésor dans la même opération. */
  const updateMember = (m: Member, delta?: Delta, label?: string) => {
    const next = { ...crew, members: crew.members.map((x) => (x.id === m.id ? m : x)) }
    setCrew(delta && label ? withTreasury(next, delta, label) : next)
  }
  const removeMember = (memberId: string) => update({ members: crew.members.filter((x) => x.id !== memberId) })
  const addMember = (p: Profile) => {
    const recruit = newMember(crew.factionId, p, crew.members.map(memberName))
    fresh.current.add(recruit.id)
    const next = { ...crew, members: [...crew.members, recruit] }
    setCrew(campaign ? withTreasury(next, { po: -p.cost }, `Recrutement : ${p.name}`) : next)
  }
  const duplicateMember = (m: Member) => {
    const freshName = randomName(crew.factionId, crew.members.map(memberName))
    const copy = { ...m, id: newId(), name: freshName, suggestedName: freshName, equipment: m.equipment.map((e) => ({ ...e })) }
    fresh.current.add(copy.id)
    const idx = crew.members.findIndex((x) => x.id === m.id)
    update({ members: [...crew.members.slice(0, idx + 1), copy, ...crew.members.slice(idx + 1)] })
  }

  async function remove() {
    const inCampaign = crew!.groupCampaign ? ` Elle est inscrite à la campagne « ${crew!.groupCampaign.name} » : vous devrez en recréer une depuis la campagne.` : ''
    if (!confirm(`Supprimer définitivement la bande « ${crew!.name || 'sans nom'} » ?${inCampaign}`)) return
    await deleteCrew(crew!.id)
    navigate('/bandes')
  }


  const cost = crewCost(crew)
  const upkeep = crewUpkeep(crew)
  const legal = isLegal(issues)
  const crewIssues = issues.filter((i) => !i.memberId)
  const active = crew.members.filter(isActive)
  const former = crew.members.filter((m) => !isActive(m))
  const hasChef = active.some((m) => isChef(profileOf(faction, m), m))
  const phase = phaseOf(crew)
  // Bande de campagne : modifiable seulement pendant la préparation d'une journée rejointe.
  const lock = lockReason(crew, dayState ?? null)


  return (
    <section className={`builder phase-${phase}`}>
      <nav className="crumbs no-print">
        <Link to="/bandes">Mes bandes</Link> <span>›</span> {crew.name || 'Bande sans nom'}
      </nav>
      {dayState && <CampaignDayBanner state={dayState} lock={lock} />}
      <div className="builder-head card">
        <div className="row wrap">
          <FactionSeal id={faction.id} name={faction.name} size={56} />
          <label className="field grow">
            <span>Nom de la bande</span>
            <input value={crew.name} onChange={(e) => update({ name: e.target.value })} placeholder="Nom de la bande" />
          </label>
          {!campaign && (
            <label className="field narrow">
              <span>Budget (PO)</span>
              <input type="number" min={0} step={10} value={crew.budget} onChange={(e) => update({ budget: Number(e.target.value) })} />
            </label>
          )}
          {!crew.groupCampaign && <label className="switch field-switch" data-tip="Désactive les contrôles du builder : effectifs, budget, mains et équipement autorisé. Pratique pour les bandes maison ou les tests.">
            <input type="checkbox" checked={!!crew.unrestricted} onChange={(e) => update({ unrestricted: e.target.checked })} />
            <span className="switch-track" aria-hidden="true" />
            <span>Sans restrictions</span>
          </label>}
        </div>
        <div className="row wrap between">
          <span className={`save-state ${saveState}`} role="status">
            {{ saved: '✓ Enregistré', pending: '● Modifications non enregistrées…', saving: '● Enregistrement…', error: `⚠ Erreur : ${saveError}` }[saveState]}
          </span>
          <div className="row wrap">
            <button className="btn" onClick={() => saveThenGo(`/bandes/${crew.id}/fiches`)} data-tip="Affiche les fiches de la bande et permet de télécharger le PDF, qui sert aussi de sauvegarde à réimporter.">Fiches à imprimer</button>
            <button className="btn danger" onClick={remove} data-tip="Supprime définitivement la bande. Téléchargez son PDF avant si vous voulez la garder.">Supprimer</button>
          </div>
        </div>
      </div>

      {phase === 'partie' ? (
        <div className="card notice live-elsewhere">
          <p>
            <strong>⚔ Partie en cours</strong> : elle se suit depuis la campagne. La bande est verrouillée jusqu'à la fin de la partie.
          </p>
          {crew.groupCampaign && <Link className="btn primary" to={`/campagnes/${crew.groupCampaign.id}`}>Aller à la campagne</Link>}
        </div>
      ) : (
      <fieldset className="builder-lock" disabled={!!lock}>
      <div className="totals-bar card">
        <div className="totals">
          {campaign ? (
            <>
              <Total label="Trésor" value={`${campaign.po} PO`} alert={campaign.po < 0} tip="Pièces d'or disponibles pour recruter, acheter et payer l'entretien." />
              <Total label="Cristaux" value={`${campaign.cristaux}`} tip="Cristaux transformés : ils se vendent 25 PO pièce dans « Trésor… »." />
              <Total label="Prestige" value={`${campaign.prestige}`} tip="Prestige gagné au fil des parties." />
              <Total label="Entretien" value={`${upkeep.po} PO${upkeep.cristaux ? ` + ${upkeep.cristaux} cristal` : ''}`} tip="À payer après chaque partie pour garder la bande (le chef ne coûte rien)." />
              <Total label="Membres" value={`${active.length}`} alert={active.length > MAX_ON_TABLE} tip={`Membres actifs. ${MAX_ON_TABLE} figurines maximum sur la table par partie.`} />
              <Total label="Parties" value={`${campaign.games.length}`} />
              <button className="btn totals-btn" onClick={() => setTreasuryOpen(true)} data-tip="Caisse de la bande : vendre des cristaux, ajuster PO, cristaux ou prestige à la main, et consulter le journal des dépenses et gains.">Trésor…</button>
            </>
          ) : (
            <>
              <Total label="Faction" value={faction.name} />
              <Total label="Dépensé" value={`${cost} / ${crew.budget} PO`} alert={cost > crew.budget} tip="Coût des recrues et de leur équipement, sur le budget de départ." />
              <Total label="Reste" value={`${crew.budget - cost} PO`} alert={cost > crew.budget} tip="Pour une bande de campagne, ce qui reste devient son trésor quand elle est validée pour la campagne." />
              <Total label="Entretien" value={`${upkeep.po} PO${upkeep.cristaux ? ` + ${upkeep.cristaux} cristal` : ''}`} tip="À payer après chaque partie pour garder la bande (le chef ne coûte rien)." />
              <Total label="Membres" value={`${crew.members.length}`} alert={crew.members.length > MAX_ON_TABLE} />
            </>
          )}
          <span className={`badge big ${crew.unrestricted ? '' : legal ? 'ok' : 'ko'} ${stamp ? 'stamp' : ''}`}>
            {crew.unrestricted ? 'Sans restrictions' : legal ? 'Bande valide' : 'Bande à corriger'}
          </span>
        </div>
      </div>

      <div className="builder-body">
        <aside className="recruit card">
          <h2>Recruter</h2>
          {campaign && <p className="muted small recruit-note">Payé avec le trésor.</p>}
          <ul>
            {faction.profiles.map((p) => {
              const count = active.filter((m) => m.profileId === p.id).length
              const full = !crew.unrestricted && count >= p.max
              // Le chef ne se recrute qu'à la création de la bande.
              const locked = !!campaign && p.role === 'chef'
              return (
                <li key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <div className="muted small">
                      {ROLE_LABELS[p.role]} · {p.cost} PO · {count}/{p.max}
                    </div>
                  </div>
                  <button className="btn recruit-add" disabled={full || locked} onClick={() => addMember(p)} aria-label={`Recruter ${p.name}`} data-tip={locked ? 'Le chef ne se recrute qu’à la création de la bande.' : full ? `Effectif maximum atteint (${p.max}).` : `Recruter : ${p.name} (${p.cost} PO)`}>
                    +
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="members">
          {crewIssues.length > 0 && <IssueList issues={crewIssues} />}
          {campaign && !hasChef && active.length > 0 && (
            <ChefSuccession faction={faction} members={active} onPick={(m) => updateMember({ ...m, promotedChef: true, gainedSkills: [...(m.gainedSkills ?? []), 'Chef'] })} />
          )}
          {active.length === 0 && <p className="muted card">Recrutez vos premiers membres dans la liste.</p>}
          {active.map((m) => (
            <MemberCard
              fresh={fresh.current.has(m.id)}
              key={m.id}
              faction={faction}
              member={m}
              campaign={!!campaign}
              issues={issues.filter((i) => i.memberId === m.id)}
              onChange={updateMember}
              onRemove={() => (campaign ? updateMember({ ...m, status: 'parti' }) : removeMember(m.id))}
              onDuplicate={() => duplicateMember(m)}
              unrestricted={!!crew.unrestricted}
              canDuplicate={!campaign && (!!crew.unrestricted || active.filter((x) => x.profileId === m.profileId).length < (profileOf(faction, m)?.max ?? 0))}
            />
          ))}

          {former.length > 0 && (
            <details className="card former">
              <summary><h2>Anciens membres ({former.length})</h2></summary>
              <ul>
                {former.map((m) => (
                  <li key={m.id}>
                    <span>
                      {m.status === 'mort' ? '✝' : '↪'} <strong>{memberName(m) || profileOf(faction, m)?.name}</strong>{' '}
                      <span className="muted small">{profileOf(faction, m)?.name} · {m.status === 'mort' ? 'mort' : 'a quitté la bande'} · niv. {m.level}</span>
                    </span>
                    <span className="row">
                      <button className="btn small ghost" onClick={() => updateMember({ ...m, status: 'actif' })}>Réintégrer</button>
                      <button className="btn small ghost danger" onClick={() => confirm('Effacer définitivement ce membre ?') && removeMember(m.id)}>Effacer</button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {campaign && campaign.games.length > 0 && (
            <details className="card history">
              <summary><h2>Historique des parties ({campaign.games.length})</h2></summary>
              <ol reversed>
                {[...campaign.games].reverse().map((g) => (
                  <li key={g.id}>
                    <strong>{g.title}</strong> <span className="muted small">{new Date(g.date).toLocaleDateString('fr-FR')}</span>
                    <ul>{g.lines.map((l, i) => <li key={i} className="small">{l}</li>)}</ul>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </div>

      </fieldset>
      )}

      {campaign && (
        <TreasuryModal open={treasuryOpen} crew={crew} onClose={() => setTreasuryOpen(false)} onApply={(delta, label) => setCrew(withTreasury(crew, delta, label))} />
      )}
    </section>
  )
}

function Total({ label, value, alert, tip }: { label: string; value: string; alert?: boolean; tip?: string }) {
  return (
    <div className={`total ${alert ? 'alert' : ''}`} data-tip={tip}>
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <ul className="issues">
      {issues.map((i, k) => (
        <li key={k} className={i.severity}>{i.message}</li>
      ))}
    </ul>
  )
}

/** Mort du chef : le membre au meilleur Commandement (puis le plus expérimenté) est proposé. */
function ChefSuccession({ faction, members, onPick }: { faction: Faction; members: Member[]; onPick: (m: Member) => void }) {
  const ranked = [...members].sort((a, b) => {
    const pa = profileOf(faction, a)
    const pb = profileOf(faction, b)
    const ca = pa ? effectiveStats(pa, a).cmd ?? 99 : 99
    const cb = pb ? effectiveStats(pb, b).cmd ?? 99 : 99
    return ca - cb || b.xp - a.xp
  })
  const [pick, setPick] = useState(ranked[0]?.id ?? '')
  return (
    <div className="card succession">
      <h2>Le chef est tombé</h2>
      <p className="small">Le combattant au meilleur Commandement prend le relais et gagne la compétence Chef (à égalité, le plus expérimenté).</p>
      <div className="row wrap">
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Nouveau chef">
          {ranked.map((m) => {
            const p = profileOf(faction, m)
            return <option key={m.id} value={m.id}>{memberName(m) || p?.name} — Comm {p ? effectiveStats(p, m).cmd : '?'}+, {m.xp} XP</option>
          })}
        </select>
        <button className="btn primary small" onClick={() => { const m = members.find((x) => x.id === pick); if (m) onPick(m) }}>Nommer chef</button>
      </div>
    </div>
  )
}

function TreasuryModal({ open, crew, onClose, onApply }: { open: boolean; crew: Crew; onClose: () => void; onApply: (d: Delta, label: string) => void }) {
  const [po, setPo] = useState(0)
  const [cristaux, setCristaux] = useState(0)
  const [prestige, setPrestige] = useState(0)
  const [label, setLabel] = useState('')
  const [sell, setSell] = useState(1)
  const c = crew.campaign!
  const reset = () => { setPo(0); setCristaux(0); setPrestige(0); setLabel('') }
  return (
    <Modal open={open} title="Trésor de la bande" kicker={`${c.po} PO · ${c.cristaux} cristaux · ${c.prestige} prestige`} onClose={onClose} wide>
      <h4>Vendre des cristaux</h4>
      <div className="row wrap">
        <input type="number" min={1} max={c.cristaux} value={sell} onChange={(e) => setSell(Number(e.target.value))} aria-label="Cristaux à vendre" className="narrow" />
        <span className="small">× {CRYSTAL_PRICE} PO = {sell * CRYSTAL_PRICE} PO</span>
        <button className="btn small" disabled={sell < 1 || sell > c.cristaux} onClick={() => onApply({ cristaux: -sell, po: sell * CRYSTAL_PRICE }, `Vente de ${sell} cristal${sell > 1 ? 'aux' : ''}`)}>Vendre</button>
      </div>
      <h4>Ajustement manuel</h4>
      <div className="row wrap">
        <label className="field narrow"><span>PO</span><input type="number" value={po} onChange={(e) => setPo(Number(e.target.value))} /></label>
        <label className="field narrow"><span>Cristaux</span><input type="number" value={cristaux} onChange={(e) => setCristaux(Number(e.target.value))} /></label>
        <label className="field narrow"><span>Prestige</span><input type="number" value={prestige} onChange={(e) => setPrestige(Number(e.target.value))} /></label>
        <label className="field grow"><span>Motif</span><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. : récompense de scénario" /></label>
      </div>
      <div>
        <button className="btn small primary" disabled={!po && !cristaux && !prestige} onClick={() => { onApply({ po, cristaux, prestige }, label || 'Ajustement manuel'); reset() }}>
          Appliquer
        </button>
      </div>
      <h4>Journal</h4>
      <ul className="ledger">
        {[...c.log].reverse().slice(0, 30).map((l, i) => (
          <li key={i}>
            <span className="muted small">{new Date(l.date).toLocaleDateString('fr-FR')}</span> {l.label}
            <span className="ledger-values">
              {l.po ? `${l.po > 0 ? '+' : ''}${l.po} PO ` : ''}
              {l.cristaux ? `${l.cristaux > 0 ? '+' : ''}${l.cristaux} cr. ` : ''}
              {l.prestige ? `${l.prestige > 0 ? '+' : ''}${l.prestige} prest.` : ''}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

interface MemberCardProps {
  /** Membre tout juste recruté : la carte « se pose ». */
  fresh?: boolean
  faction: Faction
  member: Member
  campaign: boolean
  issues: Issue[]
  onChange: (m: Member, delta?: Delta, label?: string) => void
  onRemove: () => void
  onDuplicate: () => void
  canDuplicate: boolean
  unrestricted: boolean
}

type Dialog = 'injury' | 'advance' | 'loot' | null

function MemberCard({ fresh, faction, member, campaign, issues, onChange, onRemove, onDuplicate, canDuplicate, unrestricted }: MemberCardProps) {
  const profile = profileOf(faction, member)
  const [adding, setAdding] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [xpGain, setXpGain] = useState(0)
  const [lastMessages, setLastMessages] = useState<string[]>([])
  // XP gagnée depuis la dernière visite (par exemple après le bilan) : la barre se remplit sous vos yeux.
  const xpNext = nextThreshold(member.xp)
  const xpPct = xpNext ? Math.min(100, (member.xp / xpNext) * 100) : 100
  const seenKey = `amatika.xpSeen.${member.id}`
  const [xpShown, setXpShown] = useState(() => {
    try {
      const seen = Number(localStorage.getItem(seenKey))
      return seen && seen < member.xp && xpNext ? Math.min(100, (seen / xpNext) * 100) : xpPct
    } catch {
      return xpPct
    }
  })
  const [xpGained] = useState(() => {
    try {
      const seen = Number(localStorage.getItem(seenKey))
      return seen && seen < member.xp ? member.xp - seen : 0
    } catch {
      return 0
    }
  })
  useEffect(() => {
    const t = setTimeout(() => setXpShown(xpPct), 250)
    try {
      localStorage.setItem(seenKey, String(member.xp))
    } catch {
      // stockage indisponible : pas d'animation, sans conséquence
    }
    return () => clearTimeout(t)
  }, [xpPct, seenKey, member.xp])
  if (!profile) return <div className="card error">Profil inconnu : {member.profileId}</div>

  const who = memberName(member) || profile.name
  const allowed = unrestricted ? equipment : equipment.filter((e) => profile.equipment.includes(e.id))
  const categories = [...new Set(allowed.map((e) => e.category))].sort((a, b) => CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b], 'fr'))
  const mage = isMage(profile)
  const spellIds = member.spellIds ?? []
  const knownSpells = spellIds.map((id) => spellById(id)).filter((sp): sp is Spell => !!sp)
  const availableSpells = spellsFor(faction.id, profile.id)
  const setSpells = (ids: string[]) => onChange({ ...member, spellIds: ids })
  const baseSpells = baseSpellCount(profile)
  // Cités-États : tant que le 2e sort de départ n'est pas choisi, on le propose avant tout ajout.
  const pickSecond = mage && choosesSecondSpell(faction.id, profile) && spellIds.length < baseSpells
  const drawSecondSpell = () => {
    const pool = availableSpells.filter((sp) => !sp.universal && !spellIds.includes(sp.id))
    const draft = [...pool].sort(() => Math.random() - 0.5).slice(0, 5).map((sp) => sp.id)
    onChange({ ...member, spellDraft: draft })
  }
  const skillsShown = memberSkills(profile, member)
  const choiceSkills = new Set(member.skillChoices)
  const loot = lootItems(member)
  // Un objet racial n'est proposé qu'aux profils qui ont accès à l'équipement de base (arbalète, arc…).
  const racialItems = racialItemsOf(faction.id).filter((it) => unrestricted || !it.requires || profile.equipment.includes(it.requires))

  const setSlot = (index: number, slot: Slot) =>
    onChange({ ...member, equipment: member.equipment.map((r, i) => (i === index ? { ...r, slot } : r)) })
  const removeItem = (index: number, sell: boolean) => {
    const item = equipment.find((e) => e.id === member.equipment[index].itemId)
    const next = { ...member, equipment: member.equipment.filter((_, i) => i !== index) }
    if (campaign && sell && item) onChange(next, { po: Math.floor(item.price / 2) }, `Vente : ${item.name} (${who})`)
    else onChange(next)
  }
  const addItem = (itemId: string) => {
    if (!itemId) return
    if (itemId.startsWith('racial:')) {
      // Objet racial acheté à la création : payé sur le budget de la bande.
      onChange({ ...member, loot: [...(member.loot ?? []), { id: newId(), key: itemId.slice(7), slot: 'porte' as Slot, racial: true }] })
      setAdding('')
      return
    }
    const item = equipment.find((e) => e.id === itemId)
    const next = { ...member, equipment: [...member.equipment, { itemId, slot: 'porte' as Slot }] }
    if (campaign && item) onChange(next, { po: -item.price }, `Achat : ${item.name} (${who})`)
    else onChange(next)
    setAdding('')
  }
  const setLootSlot = (lootId: string, slot: Slot) =>
    onChange({ ...member, loot: (member.loot ?? []).map((l) => (l.id === lootId ? { ...l, slot } : l)) })
  const setLootUsed = (lootId: string, used: boolean) =>
    onChange({ ...member, loot: (member.loot ?? []).map((l) => (l.id === lootId ? { ...l, used } : l)) })
  const removeLoot = (lootId: string, sell: boolean) => {
    const entry = loot.find((l) => l.ref.id === lootId)
    const next = { ...member, loot: (member.loot ?? []).filter((l) => l.id !== lootId) }
    const price = entry?.item?.price ?? 0
    if (sell && price) onChange(next, { po: Math.floor(price / 2) }, `Vente : ${entry?.item?.name} (${who})`)
    else onChange(next)
  }
  const giveItem = (pick: LootPick) => {
    const label = `${pick.paid ? 'Achat' : 'Objet trouvé'} : `
    if (pick.kind === 'loot') {
      const name = itemByKey(pick.key)?.name ?? pick.key
      const next = { ...member, loot: [...(member.loot ?? []), { id: newId(), key: pick.key, slot: 'sac' as Slot }] }
      onChange(next, pick.paid ? { po: -pick.price } : undefined, pick.paid ? `${label}${name} (${who})` : undefined)
    } else {
      const next = { ...member, equipment: [...member.equipment, { itemId: pick.itemId, slot: 'sac' as Slot }] }
      onChange(next, pick.paid ? { po: -pick.price } : undefined, pick.paid ? `${label}${equipment.find((e) => e.id === pick.itemId)?.name} (${who})` : undefined)
    }
    setDialog(null)
  }

  const hasError = issues.some((i) => i.severity === 'error')
  const wornCount = member.equipment.filter((r) => r.slot === 'porte').length + loot.filter((l) => l.ref.slot === 'porte').length
  const bagCount = member.equipment.length + loot.length - wornCount
  const pending = pendingLevels(member)
  const next = nextThreshold(member.xp)
  const upkeep = memberUpkeep(profile, member)
  // Chef (ou promu chef), spécialiste, recrue ou monstre : chaque rôle a son style de carte.
  const roleClass = member.promotedChef || isChef(profile, member) ? 'chef' : profile.role


  return (
    <article className={`unit-card member role-${roleClass} ${hasError ? 'has-error' : ''} ${fresh ? 'settle' : ''}`}>
      <header className="unit-band">
        <span className="member-name-wrap">
          {roleClass === 'chef' && <span className="crown" aria-label="Chef" data-tip="Chef de la bande">♛</span>}
          <input
            className="member-name"
            value={member.name}
            onChange={(e) => onChange({ ...member, name: e.target.value })}
            placeholder={`Nom (${profile.name})`}
            aria-label="Nom du personnage"
          />
          {/* Tant que le nom proposé n'a pas été modifié (ou s'il est vide), le dé en propose un autre. */}
          {(!member.name.trim() || member.name === member.suggestedName) && (
            <button
              className="icon-btn name-dice"
              onClick={() => {
                const next = randomName(faction.id, [memberName(member)])
                onChange({ ...member, name: next, suggestedName: next })
              }}
              title="Proposer un autre nom"
              aria-label="Proposer un autre nom"
            >
              🎲
            </button>
          )}
        </span>
        <span className="unit-role">
          {member.promotedChef ? 'Chef · ' : ''}{profile.name}{campaign ? ` · niv. ${member.level}` : ` · ${memberCost(faction, member)} PO`}
        </span>
      </header>

      <div className="unit-body">
        <StatLine stats={effectiveStats(profile, member)} base={profile.stats} />

        <div className="tags">
          {skillsShown.filter((s) => !choiceSkills.has(s)).map((s) => <SkillTag key={s} name={s} />)}
          {profile.skillChoices.map((choices, i) => (
            <select
              key={i}
              className="inline-select"
              value={member.skillChoices[i] ?? ''}
              onChange={(e) => {
                const nextChoices = [...member.skillChoices]
                nextChoices[i] = e.target.value
                onChange({ ...member, skillChoices: nextChoices })
              }}
            >
              <option value="">Choisir : {choices.join(' / ')}</option>
              {choices.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ))}
        </div>
        {campaign && (member.missNextGame || member.leavesAfterGame) && (
          <div className="tags">
            {member.missNextGame && <span className="badge ko">Blessure grave : manque la prochaine partie</span>}
            {member.leavesAfterGame && <span className="badge ko">Quittera la bande après la partie</span>}
          </div>
        )}
        {profile.notes.length > 0 && <p className="note small">{profile.notes.join(' ')}</p>}
        {issues.length > 0 && <IssueList issues={issues} />}
      </div>

      {campaign && (
        <details className="unit-section" open>
          <summary>
            Campagne <span className="muted small">(niv. {member.level} · {member.xp} XP · {actionsOf(member)} actions)</span>
          </summary>
          <div className="campaign-box">
            <div className="xp-row">
              <div className="xp-bar" title={next ? `${member.xp} / ${next} XP` : 'Niveau maximum'}>
                <span style={{ width: `${xpShown}%` }} />
              </div>
              {xpGained > 0 && <span className="xp-gain" aria-label={`${xpGained} XP gagnés`}>+{xpGained} XP</span>}
              <span className="small">{member.xp}{next ? ` / ${next}` : ''} XP · niveau {levelForXp(member.xp)}</span>
              {learnsNothing(profile, member) ? (
                <span className="muted small">N'apprend rien</span>
              ) : (
                <span className="row">
                  <input type="number" className="xp-input" value={xpGain || ''} placeholder="+XP" onChange={(e) => setXpGain(Number(e.target.value))} aria-label="XP à ajouter" />
                  <button className="btn small" disabled={!xpGain} onClick={() => { onChange(addXp(profile, member, xpGain)); setXpGain(0) }}>Ajouter</button>
                </span>
              )}
            </div>

            {(member.injuries ?? []).length > 0 && (
              <div className="tags">
                <span className="small muted">Blessures :</span>
                {(member.injuries ?? []).map((r) => {
                  const card = injuryById(r.cardId)
                  return (
                    <InfoTag
                      key={r.id}
                      label={card?.name ?? r.cardId}
                      kicker="Blessure"
                      className="injury-tag"
                      after={<button className="tag-remove" onClick={() => onChange(revertInjury(member, r.id))} aria-label="Annuler cette blessure">×</button>}
                    >
                      <p>{card?.description}</p>
                    </InfoTag>
                  )
                })}
              </div>
            )}
            {(member.advances ?? []).length > 0 && (
              <ul className="advances small">
                {(member.advances ?? []).map((a) => (
                  <li key={a.id}>Niv. {a.level} ({a.roll}) : {a.label}{a.spellId ? ` · sort : ${spellById(a.spellId)?.name}` : ''}</li>
                ))}
                <li><button className="link-btn" onClick={() => onChange(revertLastAdvance(member))}>Annuler la dernière montée de niveau</button></li>
              </ul>
            )}
            {lastMessages.length > 0 && <p className="notice small">{lastMessages.join(' ')}</p>}

            <div className="row wrap">
              {pending > 0 && (
                <button className="btn small primary" onClick={() => setDialog('advance')} data-tip="Jet de progression pour chaque niveau gagné : caractéristique, compétence ou sort.">▲ Monter de niveau ({pending})</button>
              )}
              <button className="btn small" onClick={() => setDialog('injury')} data-tip="Appliquer une carte Blessure, choisie ou piochée : la fiche est mise à jour.">✚ Blessure</button>
              <button className="btn small" onClick={() => setDialog('loot')} data-tip="Ajouter un objet trouvé, ou acheté avec le trésor.">⚱ Donner un objet</button>
              <button className="btn small ghost danger" onClick={() => confirm(`${who} est mort ? Son équipement sera perdu.`) && onChange({ ...member, status: 'mort' })} data-tip="Le membre meurt : il quitte la bande et son équipement est perdu.">✝ Mort</button>
            </div>
            <p className="muted small">
              Arbres : {profile.trees.length ? profile.trees.map((t) => TREE_LABELS[t] ?? t).join(', ') : 'aucun'} · entretien{' '}
              {upkeep.cristaux ? `${upkeep.cristaux} cristal` : `${upkeep.po} PO`}
            </p>
          </div>
        </details>
      )}

      <details className="unit-section" open>
        <summary>
          Équipement <span className="muted small">({wornCount} porté{wornCount > 1 ? 's' : ''}{bagCount ? `, ${bagCount} au sac` : ''})</span>
        </summary>
        <div className="equipment">
          {member.equipment.length === 0 && loot.length === 0 && <p className="muted small">Aucun équipement : combat à mains nues.</p>}
          <ul>
            {member.equipment.map((ref, i) => {
              const item = equipment.find((e) => e.id === ref.itemId)
              return (
                <li key={`e${i}`}>
                  <span><RarityDot rarity="blanc" /> {item ? <EquipmentTag item={item} /> : ref.itemId}</span>
                  <span className="muted small">{item?.price ?? 0} PO</span>
                  <SlotToggle slot={ref.slot} onChange={(s) => setSlot(i, s)} />
                  <ItemActions campaign={campaign} onSell={() => removeItem(i, true)} onDrop={() => removeItem(i, false)} />
                </li>
              )
            })}
            {loot.map(({ ref, item }) => (
              <li key={ref.id} className={ref.used ? 'used' : undefined}>
                <span>
                  <RarityDot rarity={item?.rarity ?? 'blanc'} />{' '}
                  <InfoTag label={item?.name ?? ref.key} kicker={ref.racial ? 'Objet racial' : item?.category} className="loot-tag">
                    <p><RuleText text={item?.description ?? ''} /></p>
                    {(item?.mods || item?.skills) && (
                      <p className="notice small">
                        Effet sur la fiche quand il est porté : {[formatMods(item.mods), ...(item.skills ?? [])].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {item?.price !== null && item?.price !== undefined && <p className="small muted">Valeur : {item.price} PO (revente {Math.floor(item.price / 2)} PO)</p>}
                  </InfoTag>
                  {ref.racial && <span className="badge racial-badge" title="Objet racial acheté à la création">Racial</span>}
                </span>
                {item?.consumable && ref.used ? (
                  ref.used ? (
                    <button className="btn small used-btn" onClick={() => setLootUsed(ref.id, false)} title={CONSUMABLE_HINTS[item.consumable]}>
                      ✓ Utilisé
                    </button>
                  ) : (
                    <button className="btn small" onClick={() => setLootUsed(ref.id, true)} title={CONSUMABLE_HINTS[item.consumable]}>
                      Utiliser
                    </button>
                  )
                ) : (
                  <span className="muted small">{item?.price ?? '—'} PO</span>
                )}
                <SlotToggle slot={ref.slot} onChange={(s) => setLootSlot(ref.id, s)} />
                <ItemActions campaign={campaign} onSell={() => removeLoot(ref.id, true)} onDrop={() => removeLoot(ref.id, false)} />
              </li>
            ))}
          </ul>
          <select value={adding} onChange={(e) => addItem(e.target.value)} aria-label="Ajouter un équipement">
            <option value="">{campaign ? '+ Acheter un équipement commun…' : '+ Ajouter un équipement…'}</option>
            {categories.map((cat) => (
              <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                {allowed.filter((e) => e.category === cat).map((e) => (
                  <option key={e.id} value={e.id}>{e.name} — {e.price} PO</option>
                ))}
              </optgroup>
            ))}
            {!campaign && racialItems.length > 0 && (
              <optgroup label={`Objet racial (${faction.name})`}>
                {racialItems.map((it) => (
                  <option key={it.key} value={`racial:${it.key}`}>{it.name} — {it.price ?? 0} PO</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </details>

      {mage && (
        <details className="unit-section" open>
          <summary>
            Sorts <span className="muted small">({knownSpells.length})</span>
          </summary>
          <div className="spells">
            <div className="tags">
              {knownSpells.map((sp) => (
                <SpellTag
                  key={sp.id}
                  spell={sp}
                  after={
                    // Les sorts de départ sont verrouillés pour éviter les erreurs ; les suivants peuvent être retirés.
                    spellIds.indexOf(sp.id) < baseSpells ? (
                      <span className="tag-lock" title="Sort de départ : il ne peut pas être retiré" aria-label="Sort de départ">🔒</span>
                    ) : (
                      <button className="tag-remove" onClick={() => setSpells(spellIds.filter((x) => x !== sp.id))} aria-label={`Oublier ${sp.name}`}>
                        ×
                      </button>
                    )
                  }
                />
              ))}
              {knownSpells.length === 0 && <span className="muted small">Aucun sort.</span>}
            </div>
            {pickSecond && (
              <div className="spell-draft notice">
                <strong>2e sort de départ</strong> : à choisir parmi 5 sorts tirés au hasard. Une fois choisi, il ne peut plus être changé.
                {!member.spellDraft?.length ? (
                  <div><button className="btn small primary" onClick={drawSecondSpell}>🎲 Tirer 5 sorts</button></div>
                ) : (
                  <ul className="spell-draft-list">
                    {member.spellDraft.map((id) => spellById(id)).filter((sp): sp is Spell => !!sp).map((sp) => (
                      <li key={sp.id}>
                        <SpellTag spell={sp} />
                        <button
                          className="btn small"
                          onClick={() => onChange({ ...member, spellIds: [...spellIds.slice(0, 1), sp.id, ...spellIds.slice(1)], spellDraft: undefined })}
                        >
                          Choisir
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {!pickSecond && <select value="" onChange={(e) => e.target.value && setSpells([...spellIds, e.target.value])} aria-label="Ajouter un sort">
              <option value="">+ Ajouter un sort…</option>
              {SPELL_GROUPS.map((g) => {
                const list = availableSpells.filter((sp) => g.match(sp) && !spellIds.includes(sp.id))
                if (!list.length) return null
                return (
                  <optgroup key={g.label} label={g.label}>
                    {list.map((sp) => <option key={sp.id} value={sp.id}>{sp.name} ({sp.type}, {sp.value}+)</option>)}
                  </optgroup>
                )
              })}
            </select>}
            {member.spells && <p className="muted small">Ancienne note : {member.spells}</p>}
          </div>
        </details>
      )}

      {!campaign && (
        <details className="unit-section">
          <summary>Progression</summary>
          <p className="small">
            Arbres de compétences : {profile.trees.length ? profile.trees.map((t) => TREE_LABELS[t] ?? t).join(', ') : 'aucun'}
            <br />
            Niveau {member.level} · {member.xp} XP · entretien {upkeep.cristaux ? `${upkeep.cristaux} cristal` : `${upkeep.po} PO`}
          </p>
        </details>
      )}

      <footer className="unit-actions">
        {!campaign && <button className="btn ghost small" onClick={onDuplicate} disabled={!canDuplicate} data-tip="Recruter une copie de ce membre, avec le même équipement.">Dupliquer</button>}
        <button className="btn ghost small danger" onClick={() => (!campaign || confirm(`${who} quitte la bande ?`)) && onRemove()}>
          {campaign ? 'Quitte la bande' : 'Renvoyer'}
        </button>
      </footer>

      <Modal open={dialog === 'injury'} title={`Blessure : ${who}`} kicker="Paquet Blessure" onClose={() => setDialog(null)}>
        <InjuryPicker
          onApply={(card) => {
            const res = applyInjury(member, card)
            onChange(res.member)
            setLastMessages([`${card.name} :`, ...res.messages])
            if (!card.special) setDialog(null)
          }}
          onNegotiate={() => {
            onChange(member, { po: -20 }, `Négociation avec la mort (${who})`)
            setLastMessages(['Négociation avec la mort : 20 PO payés, la blessure est annulée.'])
            setDialog(null)
          }}
        />
      </Modal>
      <Modal open={dialog === 'advance'} title={`Montée de niveau : ${who}`} kicker={`${pending} en attente`} onClose={() => setDialog(null)} wide>
        <AdvancePicker
          key={member.level}
          factionId={faction.id}
          profile={profile}
          member={member}
          onApply={(input) => {
            const updated = applyAdvance(member, input)
            onChange(updated)
            if (pendingLevels(updated) === 0) setDialog(null)
          }}
        />
      </Modal>
      <Modal open={dialog === 'loot'} title={`Donner un objet : ${who}`} onClose={() => setDialog(null)}>
        <LootPicker allowedEquipment={unrestricted ? null : profile.equipment} onPick={giveItem} />
      </Modal>
    </article>
  )
}

function SlotToggle({ slot, onChange }: { slot: Slot; onChange: (s: Slot) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Emplacement">
      <button className={slot === 'porte' ? 'on' : ''} onClick={() => onChange('porte')} data-tip="Porté : l’objet est équipé et compte sur la fiche.">Porté</button>
      <button className={slot === 'sac' ? 'on' : ''} onClick={() => onChange('sac')} data-tip="Sac à dos : l’objet est transporté, il faut une action pour l’utiliser.">Sac</button>
    </div>
  )
}

/** En campagne : vendre (moitié du prix) ou jeter. Hors campagne : retirer. */
function ItemActions({ campaign, onSell, onDrop }: { campaign: boolean; onSell: () => void; onDrop: () => void }) {
  return (
    <span className="row item-actions">
      {campaign && <button className="btn small ghost" onClick={onSell} data-tip="Vendre pour la moitié du prix (ajouté au trésor).">Vendre</button>}
      <button className="icon-btn drop-btn" onClick={onDrop} aria-label={campaign ? 'Jeter' : 'Retirer'} data-tip={campaign ? 'Jeter, sans revente' : 'Retirer'}>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
    </span>
  )
}
