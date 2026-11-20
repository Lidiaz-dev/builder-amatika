import { useCallback, useEffect, useState } from 'react'
import { equipmentById, factionById, itemByKey, itemTypeOf, spellById, spells as allSpells, spellsFor, baseSpellCount, type Spell } from '../data'
import { isActive, memberSkills, memberTitle, profileOf, type Crew, type Member, crystalWord } from '../lib/crew'
import { cancelGift, listPendingGiftsTo, sendAdminGift, type Entry, type Gift, type GiftDraft, type GroupCampaign } from '../lib/groupCampaign'
import { getCrew } from '../lib/storage'
import LootPicker, { type LootPick } from './LootPicker'
import NumberInput from './NumberInput'
import ItemChip from './ItemChip'
import RarityDot from './RarityDot'

type Players = Entry[]

/** Choix du joueur (aucun présélectionné). */
function PlayerSelect({ players, value, onChange }: { players: Players; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>Joueur</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choisir un joueur…</option>
        {players.map((p) => <option key={p.email} value={p.email}>{p.pseudo || p.email} · {p.crewName}</option>)}
      </select>
    </label>
  )
}

/** Mages d'une bande : profil Mage, compétence Mage gagnée, ou sorts déjà connus. */
const magesOf = (crew: Crew) => {
  const faction = factionById(crew.factionId)
  return crew.members.filter(isActive).filter((m) => {
    const p = profileOf(faction, m)
    return (m.spellIds ?? []).length > 0 || (!!p && memberSkills(p, m).includes('Mage'))
  })
}
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Ajout d'un sort à un mage : ses sorts habituels d'abord, puis tous les autres (« hors de ses sorts habituels »). */
function SpellAdder({ crew, planned, onAdd }: { crew: Crew; planned: { memberId: string; spellId: string }[]; onAdd: (m: Member, sp: Spell) => void }) {
  const faction = factionById(crew.factionId)
  const mages = magesOf(crew)
  const [memberId, setMemberId] = useState('')
  const [search, setSearch] = useState('')
  const [spellId, setSpellId] = useState('')
  const m = mages.find((x) => x.id === memberId)
  if (!mages.length) return <span className="muted small">Aucun mage dans cette bande.</span>
  const usual = m ? new Set(spellsFor(crew.factionId, m.profileId).map((s) => s.id)) : new Set<string>()
  const known = new Set([...(m?.spellIds ?? []), ...planned.filter((x) => x.memberId === memberId).map((x) => x.spellId)])
  const list = allSpells.filter((s) => !known.has(s.id) && (!search.trim() || norm(s.name).includes(norm(search.trim()))))
  const mine = list.filter((s) => usual.has(s.id))
  const others = list.filter((s) => !usual.has(s.id))
  const chosen = spellId ? spellById(spellId) : undefined
  return (
    <div className="stack">
      <select value={memberId} onChange={(e) => { setMemberId(e.target.value); setSpellId('') }} aria-label="Mage">
        <option value="">Choisir un mage…</option>
        {mages.map((x) => <option key={x.id} value={x.id}>{memberTitle(faction, x)} · {(x.spellIds ?? []).length} sort{(x.spellIds ?? []).length > 1 ? 's' : ''}</option>)}
      </select>
      {m && (
        <>
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setSpellId('') }} placeholder="Rechercher un sort par son nom…" aria-label="Rechercher un sort" />
          <div className="row wrap">
            <select value={spellId} onChange={(e) => setSpellId(e.target.value)} aria-label="Sort">
              <option value="">{search.trim() ? `${list.length} sort${list.length > 1 ? 's' : ''} trouvé${list.length > 1 ? 's' : ''}…` : 'Choisir un sort…'}</option>
              {mine.length > 0 && <optgroup label="Ses sorts habituels">{mine.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}
              {others.length > 0 && <optgroup label="Hors de ses sorts habituels">{others.map((s) => <option key={s.id} value={s.id}>{s.name}{s.racial ? ` (${s.racial})` : ''}</option>)}</optgroup>}
            </select>
            <button type="button" className="btn small" disabled={!chosen} onClick={() => { if (chosen) { onAdd(m, chosen); setSpellId('') } }}>+ Ajouter le sort</button>
          </div>
          {chosen && !usual.has(chosen.id) && <p className="notice small">« {chosen.name} » est hors de ses sorts habituels{chosen.racial ? ` (sort racial : ${chosen.racial})` : ''}.</p>}
        </>
      )}
    </div>
  )
}

const label = (p: Entry) => `${p.pseudo || 'Joueur'} (${p.crewName ?? 'bande'})`

/**
 * Maître de campagne : donner ou retirer des PO, des cristaux et des objets à un joueur
 * (oubli, erreur, récompense). Appliqué à la prochaine visite du joueur, même pendant une journée.
 */
export default function AdminGiftPanel({ campaign, entries }: { campaign: GroupCampaign; entries: Entry[] }) {
  const players = entries.filter((e) => e.crewId)
  if (players.length === 0) {
    return (
      <section className="card admin-gift">
        <h2>Donner ou retirer à un joueur</h2>
        <p className="muted">Aucun joueur avec une bande.</p>
      </section>
    )
  }
  return (
    <section className="card admin-gift">
      <h2>Donner ou retirer à un joueur</h2>
      <p className="muted small">
        Pour corriger un oubli ou une erreur. Appliqué à la bande du joueur dès qu'il l'ouvre, même pendant une journée.
      </p>
      <GivePart campaign={campaign} players={players} />
      <RemovePart campaign={campaign} players={players} />
    </section>
  )
}

/** Donner : PO, cristaux et n'importe quel objet du jeu (au coffre du camp). */
function GivePart({ campaign, players }: { campaign: GroupCampaign; players: Players }) {
  const [to, setTo] = useState('')
  // Montants en cours de saisie, puis ajoutés à l'envoi avec leur bouton.
  const [poInput, setPoInput] = useState(0)
  const [crInput, setCrInput] = useState(0)
  const [po, setPo] = useState(0)
  const [cristaux, setCristaux] = useState(0)
  const [items, setItems] = useState<GiftDraft['items']>([])
  const [xp, setXp] = useState<NonNullable<GiftDraft['xp']>>([])
  const [xpMember, setXpMember] = useState('')
  const [xpAmount, setXpAmount] = useState(0)
  const [spells, setSpells] = useState<NonNullable<GiftDraft['spells']>>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const target = players.find((p) => p.email === to)
  // Bande du joueur : pour choisir à quel personnage donner de l'XP.
  const [crew, setCrew] = useState<Crew | null>(null)
  useEffect(() => {
    setCrew(null)
    setXp([])
    setXpMember('')
    setSpells([])
    if (target?.crewId) getCrew(target.crewId).then(setCrew).catch(() => setCrew(null))
  }, [target?.crewId])
  const faction = crew ? factionById(crew.factionId) : undefined
  const members = crew ? crew.members.filter(isActive) : []
  const add = (pick: LootPick) => {
    if (pick.kind === 'loot') setItems((l) => [...l, { kind: 'loot', key: pick.key, name: itemByKey(pick.key)?.name ?? pick.key }])
    else setItems((l) => [...l, { kind: 'equipment', key: pick.itemId, name: equipmentById(pick.itemId)?.name ?? pick.itemId }])
  }
  const canSend = !!target && (po > 0 || cristaux > 0 || items.length > 0 || xp.length > 0 || spells.length > 0) && !busy
  const empty = po === 0 && cristaux === 0 && items.length === 0 && xp.length === 0 && spells.length === 0
  /** Montant saisi mais pas ajouté : on le signale avant d'envoyer. */
  const forgotten = poInput > 0 || crInput > 0

  const send = async () => {
    if (!target) return
    if (forgotten && !confirm(`Le montant saisi (${[poInput ? `${poInput} PO` : '', crInput ? `${crInput} ${crystalWord(crInput)}` : ''].filter(Boolean).join(', ')}) n'a pas été ajouté avec son bouton « + Ajouter » : il ne sera pas envoyé. Continuer ?`)) return
    const detail = [po ? `${po} PO` : '', cristaux ? `${cristaux} ${crystalWord(cristaux)}` : '', ...items.map((i) => i.name), ...xp.map((x) => `${x.name} +${x.amount} XP`), ...spells.map((s) => `sort ${s.spellName} (${s.name})`)].filter(Boolean).join(', ')
    if (!confirm(`Donner à ${label(target)} : ${detail} ?\n\nAjouté à sa bande dès qu'il l'ouvre.`)) return
    setBusy(true)
    setError('')
    try {
      await sendAdminGift(campaign, { to: target.email, toName: label(target), po, cristaux, items, ...(xp.length ? { xp } : {}), ...(spells.length ? { spells } : {}), ...(message.trim() ? { message: message.trim() } : {}) })
      setDone(`Donné à ${label(target)} : ${detail}. Ajouté à sa bande dès qu'il l'ouvre.`)
      setPo(0)
      setCristaux(0)
      setPoInput(0)
      setCrInput(0)
      setItems([])
      setXp([])
      setSpells([])
      setMessage('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="admin-part give">
      <summary>➕ Donner</summary>
      <div className="stack admin-gift-form">
        <PlayerSelect players={players} value={to} onChange={(v) => { setTo(v); setDone('') }} />
        <div className="row wrap admin-amounts">
          <div className="field">
            <span>PO</span>
            <div className="row amount-add">
              <NumberInput label="PO à donner" min={0} step={5} value={poInput} onChange={setPoInput} />
              <button type="button" className="btn small" disabled={poInput <= 0} onClick={() => { setPo((n) => n + poInput); setPoInput(0) }}>+ Ajouter</button>
            </div>
          </div>
          <div className="field">
            <span>Cristaux</span>
            <div className="row amount-add">
              <NumberInput label="Cristaux à donner" min={0} value={crInput} onChange={setCrInput} />
              <button type="button" className="btn small" disabled={crInput <= 0} onClick={() => { setCristaux((n) => n + crInput); setCrInput(0) }}>+ Ajouter</button>
            </div>
          </div>
        </div>
        <div className="field">
          <span>Objets (n'importe quel objet du jeu, rangé au coffre du camp)</span>
          <div className="admin-gift-picker"><LootPicker allowedEquipment={null} foundOnly searchable submitLabel="+ Ajouter l'objet" onPick={add} /></div>
        </div>
        {target && (
          <details className="admin-xp-part">
            <summary>Expérience{xp.length ? ` (${xp.length})` : ''}</summary>
            <p className="muted small">Le joueur fera ensuite la montée de niveau depuis sa bande, entre les parties.</p>
            {!crew ? (
              <span className="muted small">Chargement de la bande…</span>
            ) : (
              <div className="row wrap">
                <select value={xpMember} onChange={(e) => setXpMember(e.target.value)} aria-label="Personnage">
                  <option value="">Choisir un personnage…</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{memberTitle(faction, m)} · {m.xp} XP</option>)}
                </select>
                <NumberInput label="XP à donner" min={0} value={xpAmount} onChange={setXpAmount} />
                <button
                  type="button"
                  className="btn small"
                  disabled={!xpMember || xpAmount <= 0}
                  onClick={() => {
                    const m = members.find((x) => x.id === xpMember)
                    if (!m) return
                    setXp((l) => [...l, { memberId: m.id, name: memberTitle(faction, m), amount: xpAmount }])
                    setXpAmount(0)
                    setXpMember('')
                  }}
                >
                  + Ajouter
                </button>
              </div>
            )}
          </details>
        )}
        {target && (
          <details className="admin-xp-part">
            <summary>Sorts{spells.length ? ` (${spells.length})` : ''}</summary>
            <p className="muted small">Le mage apprend le sort dès que le joueur ouvre sa bande. N'importe quel sort du jeu peut être donné.</p>
            {!crew ? (
              <span className="muted small">Chargement de la bande…</span>
            ) : (
              <SpellAdder
                crew={crew}
                planned={spells}
                onAdd={(m, sp) => setSpells((l) => [...l, { memberId: m.id, name: memberTitle(faction, m), spellId: sp.id, spellName: sp.name, action: 'add' }])}
              />
            )}
          </details>
        )}
        <div className="field admin-basket">
          <span>Contenu de l'envoi</span>
          {empty ? (
            <p className="muted small">Rien pour l'instant : ajoutez des PO, des cristaux, des objets, de l'XP ou des sorts.</p>
          ) : (
            <div className="tags">
              {po > 0 && <span className="tag gift-amount">+{po} PO <button className="tag-remove" onClick={() => setPo(0)} aria-label="Retirer les PO">×</button></span>}
              {cristaux > 0 && <span className="tag gift-amount">+{cristaux} {crystalWord(cristaux)} <button className="tag-remove" onClick={() => setCristaux(0)} aria-label="Retirer les cristaux">×</button></span>}
              {items.map((i, k) => (
                <ItemChip
                  key={k}
                  equipmentId={i.kind === 'equipment' ? i.key : undefined}
                  lootKey={i.kind === 'loot' ? i.key : undefined}
                  after={<button className="tag-remove" onClick={() => setItems((l) => l.filter((_, j) => j !== k))} aria-label={`Retirer ${i.name}`}>×</button>}
                />
              ))}
              {xp.map((x, k) => (
                <span key={`x${k}`} className="tag gift-amount">{x.name} +{x.amount} XP <button className="tag-remove" onClick={() => setXp((l) => l.filter((_, j) => j !== k))} aria-label="Retirer l'XP">×</button></span>
              ))}
              {spells.map((s, k) => (
                <span key={`s${k}`} className="tag gift-amount">Sort {s.spellName} · {s.name} <button className="tag-remove" onClick={() => setSpells((l) => l.filter((_, j) => j !== k))} aria-label={`Retirer le sort ${s.spellName}`}>×</button></span>
              ))}
            </div>
          )}
        </div>
        <label className="field">
          <span>Message (facultatif)</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} rows={2} placeholder="Ex. : oubli de la journée 3, le casque trouvé dans les ruines." />
        </label>
        {error && <p className="error">{error}</p>}
        {done && <p className="notice ok-notice small">{done}</p>}
        <div className="row">
          <button className="btn primary" style={{ marginLeft: 'auto' }} disabled={!canSend} onClick={send}>Donner{target ? ` à ${target.pseudo || 'ce joueur'}` : ''}</button>
        </div>
      </div>
    </details>
  )
}

/**
 * Retirer : PO, cristaux et objets de la bande du joueur (rechargée à chaque ouverture),
 * et annulation des envois pas encore ajoutés à sa bande.
 */
function RemovePart({ campaign, players }: { campaign: GroupCampaign; players: Players }) {
  const [to, setTo] = useState('')
  const [crew, setCrew] = useState<Crew | null | undefined>(undefined)
  const [pending, setPending] = useState<Gift[]>([])
  const [po, setPo] = useState(0)
  const [cristaux, setCristaux] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const target = players.find((p) => p.email === to)

  const reload = useCallback(() => {
    setPicked([])
    if (!target?.crewId) {
      setCrew(undefined)
      setPending([])
      return
    }
    setCrew(null)
    getCrew(target.crewId).then((c) => setCrew(c)).catch(() => setCrew(undefined))
    listPendingGiftsTo(campaign.id, target.email).then(setPending).catch(() => setPending([]))
  }, [target?.crewId, target?.email, campaign.id])
  useEffect(() => reload(), [reload])

  const faction = crew ? factionById(crew.factionId) : undefined
  const owned: { uid: string; from: string; kind: 'equipment' | 'loot'; ref: string; key: string; name: string; owner: string }[] = []
  if (crew) {
    for (const m of crew.members.filter(isActive)) {
      m.equipment.forEach((r, i) => owned.push({ uid: `${m.id}|e|${r.itemId}|${i}`, from: m.id, kind: 'equipment', ref: r.itemId, key: r.itemId, name: equipmentById(r.itemId)?.name ?? r.itemId, owner: memberTitle(faction, m) }))
      for (const l of m.loot ?? []) owned.push({ uid: `${m.id}|l|${l.id}`, from: m.id, kind: 'loot', ref: l.id, key: l.key, name: itemByKey(l.key)?.name ?? l.key, owner: memberTitle(faction, m) })
    }
    ;(crew.campaign?.stock?.equipment ?? []).forEach((id, i) => owned.push({ uid: `c|e|${id}|${i}`, from: '__coffre', kind: 'equipment', ref: id, key: id, name: equipmentById(id)?.name ?? id, owner: 'coffre' }))
    for (const l of crew.campaign?.stock?.loot ?? []) owned.push({ uid: `c|l|${l.id}`, from: '__coffre', kind: 'loot', ref: l.id, key: l.key, name: itemByKey(l.key)?.name ?? l.key, owner: 'coffre' })
  }
  // Sorts des mages : les deux premiers (Orbe et sort racial) sont ceux de départ.
  const ownedSpells: { uid: string; memberId: string; name: string; spellId: string; spellName: string; base: boolean }[] = []
  if (crew) {
    for (const m of magesOf(crew)) {
      const p = profileOf(faction, m)
      const base = p ? baseSpellCount(p) : 2
      ;(m.spellIds ?? []).forEach((id, i) => ownedSpells.push({ uid: `${m.id}|s|${id}`, memberId: m.id, name: memberTitle(faction, m), spellId: id, spellName: spellById(id)?.name ?? id, base: i < base }))
    }
  }
  const spellsOut = ownedSpells.filter((s) => picked.includes(s.uid))
  const toRemove = owned.filter((o) => picked.includes(o.uid))
  const canSend = !!target && (po > 0 || cristaux > 0 || toRemove.length > 0 || spellsOut.length > 0) && !busy

  const send = async () => {
    if (!target) return
    const detail = [po ? `${po} PO` : '', cristaux ? `${cristaux} ${crystalWord(cristaux)}` : '', ...toRemove.map((r) => `${r.name} (${r.owner})`), ...spellsOut.map((s) => `sort ${s.spellName} (${s.name})`)].filter(Boolean).join(', ')
    const baseOut = spellsOut.filter((s) => s.base)
    const warn = baseOut.length ? `\n\nAttention : ${baseOut.map((s) => `« ${s.spellName} »`).join(', ')} ${baseOut.length > 1 ? 'sont des sorts' : 'est un sort'} de départ, que le joueur ne peut pas reprendre lui-même.` : ''
    if (!confirm(`Retirer à ${label(target)} : ${detail} ?${warn}\n\nAppliqué à sa bande dès qu'il l'ouvre.`)) return
    setBusy(true)
    setError('')
    try {
      await sendAdminGift(campaign, {
        to: target.email,
        toName: label(target),
        po: -po,
        cristaux: -cristaux,
        items: [],
        remove: toRemove.map(({ from, kind, ref, name, owner }) => ({ from, kind, ref, name, owner })),
        ...(spellsOut.length ? { spells: spellsOut.map(({ memberId, name, spellId, spellName }) => ({ memberId, name, spellId, spellName, action: 'remove' as const })) } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      })
      setDone(`Retrait demandé à ${label(target)} : ${detail}. Appliqué dès qu'il ouvre sa bande.`)
      setPo(0)
      setCristaux(0)
      setMessage('')
      reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="admin-part remove" onToggle={(e) => (e.target as HTMLDetailsElement).open && reload()}>
      <summary>➖ Retirer</summary>
      <div className="stack admin-gift-form">
        <div className="row wrap">
          <PlayerSelect players={players} value={to} onChange={(v) => { setTo(v); setDone('') }} />
          <div className="field narrow"><span>PO à retirer{crew?.campaign ? ` (sur ${crew.campaign.po})` : ''}</span><NumberInput label="PO à retirer" min={0} step={5} value={po} onChange={setPo} /></div>
          <div className="field narrow"><span>Cristaux à retirer{crew?.campaign ? ` (sur ${crew.campaign.cristaux})` : ''}</span><NumberInput label="Cristaux à retirer" min={0} value={cristaux} onChange={setCristaux} /></div>
        </div>

        {target && (
          <>
            {pending.length > 0 && (
              <div className="field">
                <span>Envois pas encore ajoutés à sa bande (il ne l'a pas rouverte depuis)</span>
                <ul className="plain-list admin-pending">
                  {pending.map((g) => (
                    <li key={g.id} className="row wrap between">
                      <span>
                        <strong>{g.fromName}</strong> : {[g.po ? `${g.po} PO` : '', g.cristaux ? `${g.cristaux} ${crystalWord(g.cristaux)}` : '', ...g.items.map((i) => i.name), ...(g.remove ?? []).map((r) => `retirer ${r.name}`), ...(g.spells ?? []).map((s) => `${s.action === 'add' ? 'sort' : 'retirer le sort'} ${s.spellName} (${s.name})`)].filter(Boolean).join(', ')}
                      </span>
                      <button
                        className="btn small ghost danger"
                        disabled={busy}
                        onClick={() => confirm('Annuler cet envoi ? Il ne sera jamais reçu.') && cancelGift(campaign.id, g.id).then(reload).catch((e) => setError((e as Error).message))}
                      >
                        Annuler l'envoi
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="field">
              <span className="row wrap between">
                Objets de sa bande (cliquez pour les retirer)
                <button type="button" className="link-btn small" onClick={reload}>↻ Actualiser</button>
              </span>
              {crew === null ? (
                <span className="muted small">Chargement de la bande…</span>
              ) : crew === undefined ? (
                <span className="error small">Bande introuvable.</span>
              ) : owned.length === 0 ? (
                <span className="muted small">Cette bande n'a aucun objet.</span>
              ) : (
                <span className="tags trade-items">
                  {owned.map((o) => (
                    <button
                      key={o.uid}
                      type="button"
                      className={`tag item-chip trade-item remove-item ${picked.includes(o.uid) ? 'on' : ''}`}
                      aria-pressed={picked.includes(o.uid)}
                      onClick={() => setPicked((r) => (r.includes(o.uid) ? r.filter((x) => x !== o.uid) : [...r, o.uid]))}
                    >
                      {picked.includes(o.uid) ? <span className="remove-check">✕</span> : <RarityDot rarity={o.kind === 'loot' ? itemByKey(o.key)?.rarity ?? 'blanc' : 'blanc'} />}
                      {o.name}{o.kind === 'loot' && <em className="item-type">{itemTypeOf(o.key)}</em>}
                      <span className="trade-owner">· {o.owner}</span>
                    </button>
                  ))}
                </span>
              )}
            </div>
            {ownedSpells.length > 0 && (
              <div className="field">
                <span>Sorts de ses mages (cliquez pour les retirer)</span>
                <span className="tags trade-items">
                  {ownedSpells.map((o) => (
                    <button
                      key={o.uid}
                      type="button"
                      className={`tag item-chip trade-item remove-item ${picked.includes(o.uid) ? 'on' : ''}`}
                      aria-pressed={picked.includes(o.uid)}
                      onClick={() => setPicked((r) => (r.includes(o.uid) ? r.filter((x) => x !== o.uid) : [...r, o.uid]))}
                      data-tip={o.base ? 'Sort de départ : le joueur ne peut pas le reprendre lui-même.' : undefined}
                    >
                      {picked.includes(o.uid) && <span className="remove-check">✕</span>}
                      {o.spellName}
                      {o.base && <em className="item-type">départ</em>}
                      <span className="trade-owner">· {o.name}</span>
                    </button>
                  ))}
                </span>
              </div>
            )}
          </>
        )}
        <label className="field">
          <span>Message (facultatif)</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} rows={2} placeholder="Ex. : épée comptée deux fois." />
        </label>
        {error && <p className="error">{error}</p>}
        {done && <p className="notice ok-notice small">{done}</p>}
        <div className="row">
          <button className="btn primary" style={{ marginLeft: 'auto' }} disabled={!canSend} onClick={send}>Retirer{target ? ` à ${target.pseudo || 'ce joueur'}` : ''}</button>
        </div>
      </div>
    </details>
  )
}
