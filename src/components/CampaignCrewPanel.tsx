import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { factionById } from '../data'
import { abandonGame, activeMembers, crewCost, MAX_ON_TABLE, memberName, newId, profileOf, type Crew } from '../lib/crew'
import { getMySheet, isOpen, joinDay, registerCrew, type Day, type GroupCampaign, type Sheet } from '../lib/groupCampaign'
import { getCrew, saveCrew } from '../lib/storage'
import { isLegal, validateCrew } from '../lib/validate'
import LiveGamePanel from './LiveGamePanel'
import MemberPeek from './MemberPeek'

/**
 * Tout ce que la bande d'un joueur fait dans la campagne : validation de départ, puis pour chaque
 * journée : rejoindre, préparer (membres et équipement), noter la partie, nuit et rapport.
 */
export default function CampaignCrewPanel({ campaign, crewId, email, day, onChanged }: {
  campaign: GroupCampaign
  crewId: string
  email: string
  day: Day | null
  /** Recharge la page (journée rejointe, bande validée…). */
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const [crew, setCrew] = useState<Crew | null | undefined>(undefined)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const open = !!day && isOpen(day.status)
  const joined = open && !!day?.participants.includes(email)

  useEffect(() => {
    getCrew(crewId).then(setCrew).catch(() => setCrew(null))
  }, [crewId])
  useEffect(() => {
    if (joined && day?.status === 'nuit') getMySheet(campaign.id, day.number).then(setSheet).catch(() => setSheet(null))
  }, [joined, day, campaign.id])

  // Sauvegarde automatique (préparation, partie en direct), 600 ms après la dernière modification.
  const latest = useRef<Crew | null>(null)
  const dirty = useRef(false)
  const first = useRef(true)
  useEffect(() => {
    if (!crew) return
    latest.current = crew
    if (first.current) {
      first.current = false
      return
    }
    dirty.current = true
    const t = setTimeout(() => {
      dirty.current = false
      saveCrew(crew).catch((e) => setError(e.message))
    }, 600)
    return () => clearTimeout(t)
  }, [crew])
  useEffect(() => () => {
    if (dirty.current && latest.current) void saveCrew(latest.current)
  }, [])

  // Journée annulée (ou bande retirée de la journée) : la partie en cours est abandonnée d'office.
  useEffect(() => {
    if (crew?.campaign?.currentGame && !joined) setCrew(abandonGame(crew))
  }, [crew, joined])

  // Journée lancée : la partie démarre d'elle-même avec les membres choisis en préparation.
  useEffect(() => {
    if (!crew?.campaign || crew.campaign.currentGame || !joined || day?.status !== 'en-cours') return
    const prep = crew.dayPrep?.campaignId === campaign.id && crew.dayPrep.day === day.number ? crew.dayPrep.members : null
    const eligible = activeMembers(crew).filter((m) => !m.missNextGame).map((m) => m.id)
    const participants = (prep ?? eligible).filter((id) => eligible.includes(id)).slice(0, MAX_ON_TABLE)
    setCrew({
      ...crew,
      dayPrep: undefined,
      campaign: {
        ...crew.campaign,
        currentGame: {
          id: newId(), title: `Journée ${day.number} : ${campaign.name}`, startedAt: new Date().toISOString(), participants,
          outOfAction: [], rawCrystals: 0, poFound: 0, prestige: 0, tallies: {}, events: [],
        },
      },
    })
  }, [crew, joined, day, campaign])

  async function saveThenGo(path: string) {
    if (latest.current) await saveCrew(latest.current)
    dirty.current = false
    navigate(path)
  }

  async function act(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (crew === undefined) return <p className="muted">Chargement de la bande…</p>
  if (!crew) return <p className="error">Bande introuvable : créez-en une nouvelle (reroll).</p>
  const faction = factionById(crew.factionId)
  if (!faction) return null
  const err = error && <p className="error">{error}</p>

  // 1. Bande en préparation : on la construit dans le builder, puis on la valide pour la campagne.
  if (!crew.campaign) {
    const legal = isLegal(validateCrew(crew))
    const gold = crew.budget - crewCost(crew)
    return (
      <div className="campaign-step">
        <p>
          Votre bande est <strong>en construction</strong> : recrutez et équipez-la dans le <Link to={`/bandes/${crew.id}`}>builder</Link>,
          puis validez-la pour la campagne. Son budget restant ({gold} PO) deviendra son trésor.
        </p>
        <button
          className="btn primary"
          disabled={!legal || busy}
          data-tip={legal ? undefined : 'La bande doit être valide (voir les erreurs dans le builder).'}
          onClick={() => {
            if (!confirm(`Valider « ${crew.name} » pour la campagne ? Son trésor de départ sera de ${gold} PO ; les achats seront ensuite payés avec ce trésor.`)) return
            const now = new Date().toISOString()
            const started: Crew = { ...crew, campaign: { startedAt: now, po: gold, cristaux: 0, prestige: 0, games: [], log: [{ date: now, label: 'Début de la campagne', po: gold }] } }
            act(async () => {
              const saved = await saveCrew(started)
              await registerCrew(campaign.id, saved)
              setCrew(saved)
            })
          }}
        >
          ✓ Valider ma bande pour la campagne
        </button>
        {!legal && <p className="muted small">La bande n'est pas encore valide : corrigez-la dans le builder.</p>}
        {err}
      </div>
    )
  }

  const c = crew.campaign
  const game = c.currentGame
  const summary = (
    <p className="muted small">
      Trésor {c.po} PO · {c.cristaux} cristaux · {c.prestige} prestige · {activeMembers(crew).length} membres · {c.games.length} partie{c.games.length > 1 ? 's' : ''}
    </p>
  )
  const live = (blocked?: string) => (
    <LiveGamePanel
      crew={crew}
      faction={faction}
      onChange={(fn) => setCrew((x) => (x ? fn(x) : x))}
      onFinish={() => saveThenGo(`/bandes/${crew.id}/apres-partie`)}
      finishBlocked={blocked}
    />
  )

  // 2. Pas de journée ouverte.
  if (!open || !day) {
    return (
      <div className="campaign-step">
        {summary}
        <p className="muted">Bande prête : en attente de la prochaine journée.</p>
      </div>
    )
  }

  // 3. Journée en préparation : rejoindre, puis choisir les membres et ajuster l'équipement.
  if (day.status === 'preparation') {
    if (!joined) {
      return (
        <div className="campaign-step">
          {summary}
          <p><strong>Journée {day.number}</strong> en préparation : rejoignez-la pour y participer.</p>
          <button className="btn primary" disabled={busy} onClick={() => act(() => joinDay(campaign, true))}>⚑ Rejoindre la journée</button>
          {err}
        </div>
      )
    }
    const eligible = activeMembers(crew).filter((m) => !m.missNextGame)
    const prep = crew.dayPrep?.campaignId === campaign.id && crew.dayPrep.day === day.number ? crew.dayPrep.members : eligible.slice(0, MAX_ON_TABLE).map((m) => m.id)
    const setPrep = (members: string[]) => setCrew({ ...crew, dayPrep: { campaignId: campaign.id, day: day.number, members } })
    return (
      <div className="campaign-step">
        {summary}
        <p><strong>Préparer la journée {day.number}</strong> : cochez les membres qui y participent ({prep.length} / {MAX_ON_TABLE}).</p>
        <ul className="check-list">
          {activeMembers(crew).map((m) => {
            const on = prep.includes(m.id)
            const p = profileOf(faction, m)
            return (
              <li key={m.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={m.missNextGame || (!on && prep.length >= MAX_ON_TABLE)}
                    onChange={() => setPrep(on ? prep.filter((x) => x !== m.id) : [...prep, m.id])}
                  />
                  <MemberPeek faction={faction} member={m}><strong>{memberName(m) || p?.name}</strong></MemberPeek> <span className="muted small">{p?.name} · niv. {m.level}</span>
                  {m.missNextGame && <span className="badge ko">Blessure grave : repos</span>}
                </label>
              </li>
            )
          })}
        </ul>
        <div className="row wrap">
          <Link className="btn" to={`/bandes/${crew.id}`} data-tip="La bande est modifiable pendant la préparation : équipement, achats, recrutement.">⚒ Préparer l'équipement</Link>
          <button className="btn ghost small" disabled={busy} onClick={() => confirm(`Quitter la journée ${day.number} ?`) && act(async () => {
            setCrew({ ...crew, dayPrep: undefined })
            await joinDay(campaign, false)
          })}>
            Quitter la journée
          </button>
        </div>
        <p className="muted small">La préparation est verrouillée quand l'organisateur lance la journée.</p>
        {err}
      </div>
    )
  }

  if (!joined) {
    return (
      <div className="campaign-step">
        {summary}
        <p className="muted">Votre bande ne participe pas à la journée {day.number}.</p>
      </div>
    )
  }

  // 4. Journée en cours : la partie se note en direct.
  if (day.status === 'en-cours') {
    return (
      <div className="campaign-step">
        {game ? live("La partie se termine à la phase de nuit, quand l'organisateur l'ouvrira.") : <p className="muted">Démarrage de la partie…</p>}
        {err}
      </div>
    )
  }

  // 5. Nuit : récupération puis rapport (XP, niveaux), qui devient le rapport de fin de nuit.
  if (sheet) {
    return (
      <div className="campaign-step">
        {summary}
        <p className="notice ok">✓ Rapport de fin de nuit validé. En attente de la clôture de la journée par l'organisateur.</p>
      </div>
    )
  }
  return (
    <div className="campaign-step">
      {summary}
      <p>
        <strong>☾ Phase de nuit</strong> : faites la récupération de votre bande (poison, blessures, butin, cristaux, entretien), puis votre rapport de fin de nuit (XP et montées de niveau).
      </p>
      <button className="btn primary" onClick={() => saveThenGo(`/bandes/${crew.id}/apres-partie`)}>☾ Récupération et rapport de fin de nuit</button>
      {err}
    </div>
  )
}
