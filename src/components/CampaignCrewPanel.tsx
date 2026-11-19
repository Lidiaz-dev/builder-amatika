import { reportInProgress } from '../lib/reportDraft'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { factionById } from '../data'
import { memberTitle, abandonGame, activeMembers, crewPath, withoutUndo, emptyStock, withTreasury, crewCost, MAX_ON_TABLE, newId, profileOf, type Crew } from '../lib/crew'
import { useAuth } from '../lib/auth'
import { sendGiftsNow, getMySheet, isAdmin, isDayReady, isOpen, joinDay, registerCrew, setDayReady, type Day, type GroupCampaign, type Sheet, loadCrewWithGifts } from '../lib/groupCampaign'
import { saveCrew, StaleCrewError } from '../lib/storage'
import { isLegal, validateCrew } from '../lib/validate'
import LiveGamePanel from './LiveGamePanel'
import Mailbox, { MailNotice } from './Mailbox'
import TradePanel from './TradePanel'
import { applyGifts, plannedText, type PlannedGift } from '../lib/trade'
import CampStockPanel from './CampStockPanel'
import Modal from './Modal'
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
  const { user } = useAuth()
  const admin = isAdmin(user)
  const [crew, setCrew] = useState<Crew | null | undefined>(undefined)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [busy, setBusy] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const [tradeOpen, setTradeOpen] = useState(false)
  const [plannedGifts, setPlannedGifts] = useState<PlannedGift[]>([])
  const [error, setError] = useState('')

  const open = !!day && isOpen(day.status)
  const joined = open && !!day?.participants.includes(email)

  const [mailRefresh, setMailRefresh] = useState(0)

  // Les envois reçus sont ajoutés à la bande dès son chargement.
  const first = useRef(true)
  // Version de la bande sur laquelle on travaille : un enregistrement ne peut pas écraser une version plus récente.
  const base = useRef<string | undefined>(undefined)
  const reloadCrew = useCallback(() => {
    loadCrewWithGifts(crewId)
      .then((c) => {
        base.current = c?.updatedAt
        first.current = true
        setCrew(c)
      })
      .catch(() => setCrew(null))
  }, [crewId])
  useEffect(() => reloadCrew(), [reloadCrew])
  /** Enregistre la bande ; si elle a changé ailleurs, on la recharge au lieu de l'écraser. */
  const persist = useCallback(
    async (c: Crew) => {
      try {
        const saved = await saveCrew(c, base.current)
        base.current = saved.updatedAt
        return saved
      } catch (e) {
        if (e instanceof StaleCrewError) {
          setError(e.message)
          reloadCrew()
        }
        throw e
      }
    },
    [reloadCrew],
  )
  useEffect(() => {
    if (joined && day?.status === 'nuit') getMySheet(campaign.id, day.number).then(setSheet).catch(() => setSheet(null))
  }, [joined, day, campaign.id])

  // Sauvegarde automatique (préparation, partie en direct), 600 ms après la dernière modification.
  const latest = useRef<Crew | null>(null)
  const dirty = useRef(false)
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
      persist(crew).catch((e) => setError(e.message))
    }, 600)
    return () => clearTimeout(t)
  }, [crew, persist])
  useEffect(() => () => {
    if (dirty.current && latest.current) void saveCrew(latest.current, base.current).catch(() => {})
  }, [])

  // Partie en cours alors que la bande ne semble plus dans la journée (journée annulée, bande retirée,
  // ou simple erreur de chargement) : rien n'est effacé d'office, le joueur choisit (voir `orphanGame`).
  const orphanGame = !!crew?.campaign?.currentGame && !joined
  // Journée lancée : la partie démarre d'elle-même avec les membres choisis en préparation.
  useEffect(() => {
    if (!crew?.campaign || crew.campaign.currentGame || !joined || day?.status !== 'en-cours') return
    const prep = crew.dayPrep?.campaignId === campaign.id && crew.dayPrep.day === day.number ? crew.dayPrep.members : null
    const eligible = activeMembers(crew).filter((m) => !m.missNextGame).map((m) => m.id)
    const participants = (prep ?? eligible).filter((id) => eligible.includes(id)).slice(0, MAX_ON_TABLE)
    setCrew({
      ...crew,
      // Préparation finie : les ajouts d'objets ne sont plus annulables.
      members: crew.members.map(withoutUndo),
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
    if (latest.current) await persist(latest.current)
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
  const err = (
    <>
      {error && <p className="error">{error}</p>}
    </>
  )

  // 1. Bande en préparation : on la construit dans le builder, puis on la valide pour la campagne.
  if (!crew.campaign) {
    const legal = isLegal(validateCrew(crew))
    const gold = crew.budget - crewCost(crew)
    return (
      <div className="campaign-step">
        <p>
          Votre bande est <strong>en construction</strong> : recrutez et équipez-la dans le <Link to={crewPath(crew)}>builder</Link>,
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
              const saved = await persist(started)
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
  const stock = c.stock ?? emptyStock()
  // Le coffre se modifie pendant la préparation (journée rejointe, pas encore validée) ; sinon on le consulte.
  // Coffre modifiable entre deux journées, ou pendant la préparation (tant qu'elle n'est pas validée).
  const between = !open || !joined
  const stockEditable = between || (day?.status === 'preparation' && !isDayReady(day, email))
  const summary = (
    <>
      {orphanGame && (
        <div className="notice">
          <p>
            <strong>Partie en cours conservée.</strong> Votre bande a une partie notée en direct
            (« {crew.campaign!.currentGame!.title} »), mais elle ne fait plus partie de la journée en cours : journée annulée, ou bande retirée par l'organisateur.
            Rien n'a été effacé. Si c'est une erreur, rechargez la page ; sinon, vous pouvez abandonner cette partie.
          </p>
          <div className="row wrap">
            <button className="btn small" onClick={() => window.location.reload()}>↻ Recharger</button>
            <button
              className="btn small ghost danger"
              disabled={busy}
              onClick={() => {
                if (!confirm(`Abandonner la partie « ${crew.campaign!.currentGame!.title} » ? Ce qui a été noté pendant la partie (blessures, butin, XP) sera perdu.`)) return
                act(async () => {
                  const saved = await persist(abandonGame(crew))
                  first.current = true
                  setCrew(saved)
                })
              }}
            >
              Abandonner la partie
            </button>
          </div>
        </div>
      )}
      <div className="muted small row wrap campaign-summary">
        <span>Trésor {c.po} PO · {c.cristaux} cristaux · {c.prestige} prestige · {activeMembers(crew).length} membres · {c.games.length} partie{c.games.length > 1 ? 's' : ''}</span>
        <span className="row">
          <button className="btn small" onClick={() => setStockOpen(true)} data-tip="Objets rangés au camp.">Coffre ({stock.equipment.length + stock.loot.length})</button>
          <Mailbox campaign={campaign} refresh={mailRefresh} />
        </span>
      </div>
      <MailNotice campaignId={campaign.id} />
      <Modal open={stockOpen} title="Coffre du camp" kicker={crew.name} onClose={() => setStockOpen(false)} wide>
        <CampStockPanel
          faction={faction}
          members={crew.members}
          stock={stock}
          readOnly={!stockEditable}
          unrestricted={!!crew.unrestricted}
          onChange={(next, m, delta, label) => setCrew((x) => {
            if (!x?.campaign) return x
            const updated = { ...x, members: m ? x.members.map((y) => (y.id === m.id ? m : y)) : x.members, campaign: { ...x.campaign, stock: next } }
            return delta && label ? withTreasury(updated, delta, label) : updated
          })}
        />
      </Modal>
    </>
  )
  const live = (blocked?: string) => (
    <LiveGamePanel
      crew={crew}
      faction={faction}
      onChange={(fn) => setCrew((x) => (x ? fn(x) : x))}
      onFinish={() => saveThenGo(`/bandes/${crew.id}/apres-partie`)}
      finishBlocked={blocked}
      hideGameControls={!admin}
    />
  )

  // Commerce avec les autres joueurs, à tout moment sauf pendant la partie : les envois partent tout de suite.
  /** Rapport de fin de nuit commencé (brouillon) : un envoi modifie la bande, le brouillon repartirait de zéro. */
  const reportStarted = reportInProgress(crew.id)
  const trade = (manage = true) => (
    <div className="campaign-step">
      <div className="row wrap">
        {manage && <Link className="btn" to={crewPath(crew)} data-tip="Entre deux journées, la bande se modifie librement : équipement, achats, recrutement.">⚒ Gérer ma bande</Link>}
        <button className="btn" onClick={() => setTradeOpen((o) => !o)} aria-expanded={tradeOpen}>⇄ Commerce</button>
      </div>
      {tradeOpen && reportStarted && (
        <p className="notice">Votre rapport de fin de nuit est commencé : l'envoi est retiré de votre bande et de votre rapport, qui reprend là où vous en étiez.</p>
      )}
      {tradeOpen && (
        <div className="between-trade">
          <TradePanel
            crew={crew}
            faction={faction}
            campaignId={campaign.id}
            gifts={plannedGifts}
            onChange={setPlannedGifts}
            intro="Envoyez de l'or, des cristaux ou des objets à un autre joueur. L'envoi part tout de suite : l'autre joueur le reçoit (PO et cristaux au trésor, objets au coffre du camp) dès qu'il ouvre sa bande."
          />
          {plannedGifts.length > 0 && (
            <div className="row">
              <button
                className="btn primary"
                style={{ marginLeft: 'auto' }}
                disabled={busy}
                onClick={() => {
                  const detail = plannedGifts.map((g) => `• ${g.toName} : ${plannedText(g)}`).join('\n')
                  if (!confirm(`Confirmer l'envoi ?\n\n${detail}\n\nL'envoi part tout de suite et ne peut pas être annulé.`)) return
                  act(async () => {
                    const res = applyGifts(crew, plannedGifts, 'Commerce')
                    // L'envoi d'abord : s'il est refusé, rien n'est retiré de la bande.
                    await sendGiftsNow(campaign, crew.name || 'Bande sans nom', plannedGifts.map(({ to, toName, po, cristaux, items, message }) => ({ to, toName, po, cristaux, items, ...(message ? { message } : {}) })))
                    const saved = await persist(res.crew)
                    first.current = true
                    setCrew(saved)
                    setPlannedGifts([])
                    setTradeOpen(false)
                    setMailRefresh((n) => n + 1)
                  })
                }}
              >
                ⇄ Envoyer maintenant
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // 2. Pas de journée ouverte : la bande se gère, le commerce est ouvert.
  if (!open || !day) {
    return (
      <div className="campaign-step">
        {summary}
        <p className="muted">Bande prête : en attente de la prochaine journée. Vous pouvez la gérer et commercer d'ici là.</p>
        {trade()}
        {err}
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
          {trade()}
          {err}
        </div>
      )
    }
    const validated = isDayReady(day, email)
    const eligible = activeMembers(crew).filter((m) => !m.missNextGame)
    const prep = crew.dayPrep?.campaignId === campaign.id && crew.dayPrep.day === day.number ? crew.dayPrep.members : eligible.slice(0, MAX_ON_TABLE).map((m) => m.id)
    const setPrep = (members: string[]) => setCrew({ ...crew, dayPrep: { campaignId: campaign.id, day: day.number, members } })
    return (
      <div className="campaign-step">
        {summary}
        {validated ? (
          <p className="notice ok-notice">✓ <strong>Bande validée pour la journée {day.number}</strong> ({prep.length} membre{prep.length > 1 ? 's' : ''}). En attente du lancement par l'organisateur.</p>
        ) : (
          <p><strong>Préparer la journée {day.number}</strong> : cochez les membres qui y participent ({prep.length} / {MAX_ON_TABLE}).</p>
        )}
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
                    disabled={validated || m.missNextGame || (!on && prep.length >= MAX_ON_TABLE)}
                    onChange={() => setPrep(on ? prep.filter((x) => x !== m.id) : [...prep, m.id])}
                  />
                  <MemberPeek faction={faction} member={m}><strong>{memberTitle(faction, m, false)}</strong></MemberPeek> <span className="muted small">{p?.name} · niv. {m.level}</span>
                  {m.missNextGame && <span className="badge ko">Blessure grave : repos</span>}
                </label>
              </li>
            )
          })}
        </ul>
        <div className="row wrap">
          {validated ? (
            <button className="btn" disabled={busy} onClick={() => act(() => setDayReady(campaign, false))} data-tip="Rouvre la préparation pour modifier les membres ou l'équipement.">
              ✎ Modifier ma préparation
            </button>
          ) : (
            <>
              <Link className="btn" to={crewPath(crew)} data-tip="La bande est modifiable pendant la préparation : équipement, achats, recrutement.">⚒ Préparer l'équipement</Link>
              <button
                className="btn primary"
                disabled={busy || prep.length === 0}
                onClick={() => act(async () => {
                  if (dirty.current && latest.current) {
                    dirty.current = false
                    await persist(latest.current)
                  }
                  await setDayReady(campaign, true)
                })}
                data-tip="Indique à l'organisateur que votre bande est prête. Vous pourrez encore rouvrir la préparation avant le lancement."
              >
                ✓ Valider ma bande pour la journée
              </button>
            </>
          )}
        </div>
        <p className="muted small">La préparation est verrouillée quand l'organisateur lance la journée.</p>
        {trade(false)}
        {err}
      </div>
    )
  }

  if (!joined) {
    return (
      <div className="campaign-step">
        {summary}
        <p className="muted">Votre bande ne participe pas à la journée {day.number} : vous pouvez la gérer et commercer.</p>
        {trade()}
        {err}
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
        {trade(false)}
        {err}
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
      {trade(false)}
      {err}
    </div>
  )
}
