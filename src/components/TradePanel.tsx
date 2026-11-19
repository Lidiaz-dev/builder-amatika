import { useEffect, useState } from 'react'
import { equipmentById, itemByKey, type Faction } from '../data'
import { isActive, memberTitle, type Crew } from '../lib/crew'
import { plannedText, TO_STOCK, type PlannedGift } from '../lib/trade'
import { currentEmail, listEntries, type Entry } from '../lib/groupCampaign'
import NumberInput from './NumberInput'
import RarityDot from './RarityDot'

/**
 * Phase Commerce : envoyer de l'or, des cristaux ou des objets à un autre joueur
 * de la campagne. Retiré de la bande à la sortie de l'étape, reçu par l'autre joueur à la clôture de la journée.
 */
export default function TradePanel({ crew, faction, campaignId, gifts, onChange, intro }: {
  crew: Crew
  faction: Faction
  campaignId?: string
  gifts: PlannedGift[]
  onChange: (gifts: PlannedGift[]) => void
  /** Texte d'explication (rapport : envoi à la fin de l'étape ; entre deux journées : envoi immédiat). */
  intro?: string
}) {
  const [players, setPlayers] = useState<Entry[] | null>(null)
  const [to, setTo] = useState('')
  const [po, setPo] = useState(0)
  const [cristaux, setCristaux] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!campaignId) return
    listEntries(campaignId)
      .then((all) => setPlayers(all.filter((e) => e.crewId && e.email !== currentEmail())))
      .catch(() => setPlayers([]))
  }, [campaignId])

  if (!campaignId) {
    return (
      <>
        <h2>Commerce</h2>
        <p className="muted">Les envois entre joueurs se font dans une campagne de groupe.</p>
      </>
    )
  }

  const c = crew.campaign!
  const usedPo = gifts.reduce((t, g) => t + g.po, 0)
  const usedCr = gifts.reduce((t, g) => t + g.cristaux, 0)
  const taken = new Set(gifts.flatMap((g) => g.sources.map((s) => `${s.from}|${s.kind}|${s.ref}`)))
  // Objets disponibles : ceux des membres actifs et du coffre, moins ceux déjà prévus dans un envoi.
  const available: { uid: string; from: string; kind: 'equipment' | 'loot'; ref: string; key: string; name: string; owner: string }[] = []
  const seenEq: Record<string, number> = {}
  const addEq = (from: string, itemId: string, owner: string) => {
    const n = (seenEq[`${from}|${itemId}`] = (seenEq[`${from}|${itemId}`] ?? 0) + 1)
    const plannedCount = gifts.flatMap((g) => g.sources).filter((s) => s.from === from && s.kind === 'equipment' && s.ref === itemId).length
    if (n <= plannedCount) return
    available.push({ uid: `${from}|equipment|${itemId}|${n}`, from, kind: 'equipment', ref: itemId, key: itemId, name: equipmentById(itemId)?.name ?? itemId, owner })
  }
  for (const m of crew.members.filter(isActive)) {
    for (const r of m.equipment) addEq(m.id, r.itemId, memberTitle(faction, m))
    for (const l of m.loot ?? []) {
      if (!taken.has(`${m.id}|loot|${l.id}`)) available.push({ uid: `${m.id}|loot|${l.id}`, from: m.id, kind: 'loot', ref: l.id, key: l.key, name: itemByKey(l.key)?.name ?? l.key, owner: memberTitle(faction, m) })
    }
  }
  for (const id of c.stock?.equipment ?? []) addEq(TO_STOCK, id, 'coffre')
  for (const l of c.stock?.loot ?? []) {
    if (!taken.has(`${TO_STOCK}|loot|${l.id}`)) available.push({ uid: `${TO_STOCK}|loot|${l.id}`, from: TO_STOCK, kind: 'loot', ref: l.id, key: l.key, name: itemByKey(l.key)?.name ?? l.key, owner: 'coffre' })
  }

  const target = players?.find((p) => p.email === to)
  const chosen = available.filter((a) => picked.includes(a.uid))
  const canSend = !!target && (po > 0 || cristaux > 0 || chosen.length > 0)
  const send = () => {
    if (!target) return
    onChange([
      ...gifts,
      {
        to: target.email,
        toName: `${target.pseudo || 'Joueur'} (${target.crewName ?? 'bande'})`,
        po,
        cristaux,
        items: chosen.map((a) => ({ kind: a.kind, key: a.key, name: a.name })),
        ...(message.trim() ? { message: message.trim() } : {}),
        sources: chosen.map((a) => ({ from: a.from, kind: a.kind, ref: a.ref, owner: a.owner })),
      },
    ])
    setPo(0)
    setCristaux(0)
    setMessage('')
    setPicked([])
  }

  return (
    <>
      <h2>Commerce</h2>
      <p className="muted small">
        {intro ??
          "Envoyez de l'or, des cristaux ou des objets à un autre joueur de la campagne. L'envoi part à la fin de cette étape, et l'autre joueur le reçoit (PO et cristaux au trésor, objets au coffre du camp) une fois la journée clôturée."}
      </p>
      {players === null && <p className="muted">Chargement des joueurs…</p>}
      {players?.length === 0 && <p className="muted">Aucun autre joueur avec une bande dans la campagne.</p>}
      {players && players.length > 0 && (
        <div className="trade-form card">
          <div className="row wrap">
            <label className="field">
              <span>Destinataire</span>
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Choisir un joueur…</option>
                {players.map((p) => <option key={p.email} value={p.email}>{p.pseudo || 'Joueur'} · {p.crewName}</option>)}
              </select>
            </label>
            <div className="field narrow"><span>PO (sur {c.po - usedPo})</span><NumberInput label="PO à envoyer" min={0} max={Math.max(0, c.po - usedPo)} step={5} value={po} onChange={setPo} /></div>
            <div className="field narrow"><span>Cristaux (sur {c.cristaux - usedCr})</span><NumberInput label="Cristaux à envoyer" min={0} max={Math.max(0, c.cristaux - usedCr)} value={cristaux} onChange={setCristaux} /></div>
          </div>
          <div className="field">
            <span>Objets (cliquez pour les ajouter à l'envoi)</span>
            {available.length === 0 ? (
              <span className="muted small">Aucun objet disponible.</span>
            ) : (
              <span className="tags trade-items">
                {available.map((a) => (
                  <button
                    key={a.uid}
                    type="button"
                    className={`tag item-chip trade-item ${picked.includes(a.uid) ? 'on' : ''}`}
                    onClick={() => setPicked((p) => (p.includes(a.uid) ? p.filter((x) => x !== a.uid) : [...p, a.uid]))}
                    aria-pressed={picked.includes(a.uid)}
                    data-tip={a.owner === 'coffre' ? 'Dans le coffre du camp' : `Porté par ${a.owner}`}
                  >
                    {picked.includes(a.uid) ? <span className="trade-check">✓</span> : <RarityDot rarity={a.kind === 'loot' ? itemByKey(a.key)?.rarity ?? 'blanc' : 'blanc'} />}
                    {a.name}
                    <span className="trade-owner">· {a.owner}</span>
                  </button>
                ))}
              </span>
            )}
          </div>
          <label className="field">
            <span>Message (facultatif)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} rows={2} placeholder="Un petit mot pour accompagner l'envoi…" />
          </label>
          <div className="row">
            <button type="button" className="btn primary" disabled={!canSend} onClick={send} style={{ marginLeft: 'auto' }}>
              Préparer l'envoi{target ? ` à ${target.pseudo || 'ce joueur'}` : ''}
            </button>
          </div>
        </div>
      )}
      {gifts.length > 0 && (
        <>
          <h3>Envois prévus</h3>
          <ul className="plain-list trade-list">
            {gifts.map((g, i) => (
              <li key={i} className="row wrap between">
                <span><strong>{g.toName}</strong> : {plannedText(g)}{g.message && <em className="gift-message"> « {g.message} »</em>}</span>
                <button className="icon-btn drop-btn" onClick={() => onChange(gifts.filter((_, j) => j !== i))} aria-label="Annuler cet envoi" data-tip="Annuler cet envoi">×</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
