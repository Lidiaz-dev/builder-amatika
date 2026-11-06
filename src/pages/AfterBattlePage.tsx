import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { equipmentById, factionById, injuryById, itemByKey, type Faction } from '../data'
import {
  CRYSTAL_PRICE,
  isActive,
  isChef,
  lootItems,
  memberSkills,
  memberUpkeep,
  newId,
  profileOf,
  withTreasury,
  type Crew,
  type Member,
  memberName,
} from '../lib/crew'
import { addXp, applyAdvance, applyInjury, d10, revertInjury, learnsNothing, pendingLevels, poisonThreshold } from '../lib/campaign'
import { getCrew, saveCrew } from '../lib/storage'
import DiceInput from '../components/DiceInput'
import Modal from '../components/Modal'
import InjuryPicker from '../components/InjuryPicker'
import AdvancePicker from '../components/AdvancePicker'
import LootPicker, { type LootPick } from '../components/LootPicker'
import { submitSheetIfNeeded } from '../lib/groupCampaign'
import { DECKS } from '../lib/decks'
import RarityDot from '../components/RarityDot'
import RuleText from '../components/RuleText'

const STEPS = ['Participants', 'Objets utilisés', 'Morts et blessures', 'Butin', 'Entretien', 'Expérience', 'Niveaux', 'Résumé']
// Index des étapes.
const S = { participants: 0, items: 1, injuries: 2, loot: 3, upkeep: 4, xp: 5, levels: 6, summary: 7 }

interface XpInput {
  participation: number | null
  places: number
  damage: number
  kills: number
  liqueur?: number
}

const nameOf = (faction: Faction, m: Member) => memberName(m) || profileOf(faction, m)?.name || '?'

// Brouillon de l'assistant conservé dans le navigateur, pour reprendre là où on s'était arrêté.
const wizardKey = (crewId: string) => `amatika.wizard.${crewId}`

interface WizardSnapshot {
  /** Version de la bande au démarrage de l'assistant : si elle a changé, le brouillon est périmé. */
  base: string
  step: number
  draft: Crew
  exits: Crew[]
  logs: string[][]
  title: string
  participants: string[]
  rawCrystals: number
  rolls: (number | null)[]
  poFound: number
  prestigeGained: number
  leaving: string[]
  poisonRolls: Record<string, number | null>
  xp: Record<string, XpInput>
  liqueurDice: Record<string, number>
  /** Cartes Marché noir distribuées (clés d'objets) et indices de celles achetées. */
  market?: string[]
  marketBought?: number[]
  /** Cristaux magiques du butin vendus tout de suite (25 PO pièce). */
  crystalsSold?: number
}

/** Cartes Marché noir distribuées : 4, plus 1 par figurine avec Soldat de la Pègre. */
function drawMarket(count: number): string[] {
  const deck = [...(DECKS.find((d) => d.id === 'marche-noir')?.cards ?? [])]
  const out: string[] = []
  while (out.length < count && deck.length) out.push(deck.splice(Math.floor(Math.random() * deck.length), 1)[0].ref)
  return out
}

function readSnapshot(crewId: string): WizardSnapshot | null {
  try {
    return JSON.parse(localStorage.getItem(wizardKey(crewId)) ?? 'null') as WizardSnapshot | null
  } catch {
    return null
  }
}

export default function AfterBattlePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [original, setOriginal] = useState<Crew | null | undefined>(undefined)
  const [step, setStep] = useState(0)
  // Brouillon de la bande pendant l'assistant, et état à la sortie de chaque étape (pour revenir en arrière).
  const [draft, setDraft] = useState<Crew | null>(null)
  const [exits, setExits] = useState<Crew[]>([])
  const [logs, setLogs] = useState<string[][]>(STEPS.map(() => []))
  const [title, setTitle] = useState('')
  const [participants, setParticipants] = useState<string[]>([])
  // Butin
  const [rawCrystals, setRawCrystals] = useState(0)
  const [rolls, setRolls] = useState<(number | null)[]>([])
  const [poFound, setPoFound] = useState(0)
  const [prestigeGained, setPrestigeGained] = useState(0)
  const [crystalsSold, setCrystalsSold] = useState(0)
  // Entretien
  const [leaving, setLeaving] = useState<string[]>([])
  // Objets utilisés : jet de réserve de chaque poison (par id d'objet)
  const [poisonRolls, setPoisonRolls] = useState<Record<string, number | null>>({})
  // Expérience
  const [xp, setXp] = useState<Record<string, XpInput>>({})
  /** D10 d'XP des liqueurs bues, par figurine (calculés en quittant l'étape des objets). */
  const [liqueurDice, setLiqueurDice] = useState<Record<string, number>>({})
  // Marché noir
  const [market, setMarket] = useState<string[] | null>(null)
  const [marketBought, setMarketBought] = useState<number[]>([])
  const [buyer, setBuyer] = useState<Record<number, string>>({})
  // Fenêtres
  const [injuryFor, setInjuryFor] = useState<string | null>(null)
  const [lootFor, setLootFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resumed, setResumed] = useState(false)

  /** Démarre l'assistant depuis la bande, pré-rempli avec la partie en cours si elle existe. */
  function startFrom(c: Crew) {
    const live = c.campaign?.currentGame
    // Partie notée en direct : les participants sont déjà connus (choisis en préparation), on passe directement aux objets.
    setStep(live ? S.items : 0)
    setDraft(c)
    setExits(live ? [c] : [])
    setLeaving([])
    setPoisonRolls({})
    setLiqueurDice({})
    setMarket(null)
    setMarketBought([])
    setCrystalsSold(0)
    setRolls([])
    if (live) {
      setTitle(live.title)
      setParticipants(live.participants)
      setRawCrystals(live.rawCrystals)
      setPoFound(live.poFound)
      setPrestigeGained(live.prestige)
      setXp(Object.fromEntries(live.participants.map((mid) => {
        const t = live.tallies[mid]
        return [mid, { participation: null, places: t?.places ?? 0, damage: t?.damageXp ?? 0, kills: t?.kills ?? 0 }]
      })))
      setLogs(STEPS.map((_, i) =>
        i === S.injuries ? live.events.filter((e) => e.step === 'injuries').map((e) => e.text)
          : i === S.loot ? live.events.filter((e) => e.step === 'loot').map((e) => e.text)
            : []))
    } else {
      setTitle(`Partie ${(c.campaign?.games.length ?? 0) + 1}`)
      setParticipants(c.members.filter((m) => isActive(m) && !m.missNextGame).slice(0, 10).map((m) => m.id))
      setRawCrystals(0)
      setPoFound(0)
      setPrestigeGained(0)
      setXp({})
      setLogs(STEPS.map(() => []))
    }
  }

  useEffect(() => {
    getCrew(id!).then((c) => {
      setOriginal(c)
      if (!c) return
      const snap = readSnapshot(c.id)
      if (snap && snap.base === c.updatedAt) {
        setStep(snap.step)
        setDraft(snap.draft)
        setExits(snap.exits)
        setLogs(snap.logs)
        setTitle(snap.title)
        setParticipants(snap.participants)
        setRawCrystals(snap.rawCrystals)
        setRolls(snap.rolls)
        setPoFound(snap.poFound)
        setPrestigeGained(snap.prestigeGained)
        setLeaving(snap.leaving)
        setPoisonRolls(snap.poisonRolls)
        setXp(snap.xp)
        setLiqueurDice(snap.liqueurDice)
        setMarket(snap.market ?? null)
        setMarketBought(snap.marketBought ?? [])
        setCrystalsSold(snap.crystalsSold ?? 0)
        setResumed(snap.step > 0)
      } else {
        startFrom(c)
      }
    }).catch(() => setOriginal(null))
  }, [id])

  // Enregistre le brouillon à chaque changement.
  useEffect(() => {
    if (!original || !draft || saving) return
    const snap: WizardSnapshot = {
      base: original.updatedAt, step, draft, exits, logs, title, participants, rawCrystals, rolls,
      poFound, prestigeGained, leaving, poisonRolls, xp, liqueurDice, market: market ?? undefined, marketBought, crystalsSold,
    }
    try {
      localStorage.setItem(wizardKey(original.id), JSON.stringify(snap))
    } catch {
      // Stockage indisponible (navigation privée…) : l'assistant marche quand même, sans reprise.
    }
  }, [original, draft, step, exits, logs, title, participants, rawCrystals, rolls, poFound, prestigeGained, leaving, poisonRolls, xp, liqueurDice, market, marketBought, crystalsSold, saving])

  if (original === undefined) return <p className="muted">Chargement…</p>
  const faction = original ? factionById(original.factionId) : undefined
  if (!original || !draft || !faction) return <p className="error">Bande introuvable. <Link to="/bandes">Retour</Link></p>
  if (!original.campaign) {
    return (
      <p className="notice">
        La campagne n'a pas encore commencé pour cette bande. <Link to={`/bandes/${original.id}`}>Retour au builder</Link>
      </p>
    )
  }

  const log = (line: string) => setLogs((all) => all.map((l, i) => (i === step ? [...l, line] : l)))
  const setMember = (m: Member) => setDraft((d) => d && { ...d, members: d.members.map((x) => (x.id === m.id ? m : x)) })
  const memberById = (mid: string) => draft.members.find((m) => m.id === mid)!
  /** Retire la dernière ligne du journal de l'étape qui commence par `prefix` ; sinon ajoute `fallback`. */
  const unlog = (prefix: string, fallback?: string) =>
    setLogs((all) =>
      all.map((l, i) => {
        if (i !== step) return l
        const k = l.map((x) => x.startsWith(prefix)).lastIndexOf(true)
        return k >= 0 ? l.filter((_, j) => j !== k) : fallback ? [...l, fallback] : l
      }),
    )
  const removeInjury = (m: Member, recordId: string) => {
    const card = injuryById((m.injuries ?? []).find((r) => r.id === recordId)?.cardId ?? '')
    if (!confirm(`Retirer la blessure « ${card?.name ?? '?'} » de ${nameOf(faction, m)} ? Ses effets sur la fiche sont annulés.`)) return
    setMember(revertInjury(m, recordId))
    unlog(`${nameOf(faction, m)} : ${card?.name ?? ''}`)
  }
  const sellItem = (m: Member, kind: 'equipment' | 'loot', ref: string | number, name: string, price: number) => {
    const gain = Math.floor(price / 2)
    if (!confirm(`Vendre « ${name} » de ${nameOf(faction, m)} pour ${gain} PO ?`)) return
    setDraft((d) => {
      if (!d) return d
      const members = d.members.map((x) =>
        x.id !== m.id ? x : kind === 'loot' ? { ...x, loot: (x.loot ?? []).filter((l) => l.id !== ref) } : { ...x, equipment: x.equipment.filter((_, i) => i !== ref) },
      )
      return withTreasury({ ...d, members }, { po: gain }, `${title} : vente de ${name}`)
    })
    log(`${nameOf(faction, m)} vend : ${name} (+${gain} PO)`)
  }
  const buyMarket = (index: number) => {
    const key = market?.[index]
    const item = key ? itemByKey(key) : undefined
    const m = draft.members.find((x) => x.id === (buyer[index] ?? alivePlaying[0]?.id))
    if (!key || !item || item.price === null || !m) return
    const price = item.price
    setDraft((d) => {
      if (!d) return d
      const members = d.members.map((x) => (x.id === m.id ? { ...x, loot: [...(x.loot ?? []), { id: newId(), key, slot: 'sac' as const }] } : x))
      return withTreasury({ ...d, members }, { po: -price }, `${title} : marché noir, ${item.name}`)
    })
    setMarketBought((b) => [...b, index])
    log(`Marché noir : ${item.name} acheté pour ${nameOf(faction, m)} (${price} PO)`)
  }
  const loseItem = (m: Member, kind: 'equipment' | 'loot', ref: string | number, name: string) => {
    if (!confirm(`${nameOf(faction, m)} perd « ${name} » ? L'objet quitte la bande.`)) return
    setMember(kind === 'loot' ? { ...m, loot: (m.loot ?? []).filter((l) => l.id !== ref) } : { ...m, equipment: m.equipment.filter((_, i) => i !== ref) })
    const who = memberName(m) || profileOf(faction, m)?.name
    unlog(`${who} récupère : ${name}`, `${nameOf(faction, m)} perd : ${name}`)
  }
  const playing = participants.map(memberById).filter(Boolean)
  const alivePlaying = playing.filter(isActive)
  const prospectors = alivePlaying.filter((m) => {
    const p = profileOf(faction, m)
    return p && memberSkills(p, m).some((s) => s.toLowerCase() === 'prospection')
  }).length
  const diceCount = rawCrystals > 0 ? rawCrystals + prospectors : 0
  const keptCrystals = [...rolls.slice(0, diceCount)].filter((r): r is number => r !== null).sort((a, b) => b - a).slice(0, rawCrystals)
  const crystalsGained = keptCrystals.reduce((s, r) => s + r, 0)

  // Entretien calculé sur le brouillon (après les morts).
  const stayers = draft.members.filter((m) => isActive(m) && !leaving.includes(m.id))
  const upkeepPo = stayers.reduce((s, m) => s + memberUpkeep(profileOf(faction, m), m).po, 0)
  const upkeepCr = stayers.reduce((s, m) => s + memberUpkeep(profileOf(faction, m), m).cristaux, 0)
  const treasury = draft.campaign!

  const hasLiqueur = Object.values(liqueurDice).some(Boolean)
  const xpTotal = (mid: string) => {
    const v = xp[mid]
    if (!v) return 0
    return (v.participation ?? 0) + 5 * v.places + v.damage + 5 * v.kills + (v.liqueur ?? 0)
  }

  /** Effets d'une étape appliqués quand on passe à la suivante. */
  function applyStep(k: number, c: Crew): { crew: Crew; lines: string[] } {
    const lines: string[] = []
    if (k === S.items) {
      const dice: Record<string, number> = {}
      c = {
        ...c,
        members: c.members.map((m) => {
          const used = lootItems(m).filter(({ ref }) => ref.used)
          if (!used.length) return m
          const who = nameOf(faction!, m)
          const p = profileOf(faction!, m)
          const keep = new Set<string>()
          for (const { ref, item } of used) {
            if (item?.xpDice) dice[m.id] = (dice[m.id] ?? 0) + item.xpDice
            if (item?.consumable === 'poison' && p) {
              const roll = poisonRolls[ref.id]
              const kept = roll !== null && roll !== undefined && roll > poisonThreshold(p, m)
              if (kept) keep.add(ref.id)
              lines.push(`${who} : ${item.name} ${kept ? 'conservé' : 'épuisé'} (jet ${roll ?? '?'})`)
            } else {
              lines.push(`${who} : ${item?.name ?? ref.key} défaussé`)
            }
          }
          return {
            ...m,
            loot: (m.loot ?? []).filter((l) => !l.used || keep.has(l.id)).map((l) => (l.used ? { ...l, used: false } : l)),
          }
        }),
      }
      setLiqueurDice(dice)
    }
    if (k === S.loot) {
      const sold = Math.min(crystalsSold, crystalsGained)
      if (crystalsGained) lines.push(`${crystalsGained} cristaux magiques (cristaux bruts : ${keptCrystals.join(', ')})`)
      if (sold) lines.push(`${sold} cristaux vendus : +${sold * CRYSTAL_PRICE} PO`)
      if (poFound) lines.push(`${poFound} PO récupérées`)
      if (prestigeGained) lines.push(`${prestigeGained} de prestige`)
      const delta = { cristaux: crystalsGained - sold, po: poFound + sold * CRYSTAL_PRICE, prestige: prestigeGained }
      if (crystalsGained || poFound || prestigeGained) c = withTreasury(c, delta, `${title} : butin`)
    }
    if (k === S.upkeep) {
      c = withTreasury(c, { po: -upkeepPo, cristaux: -upkeepCr }, `${title} : entretien`)
      lines.push(`Entretien payé : ${upkeepPo} PO${upkeepCr ? ` et ${upkeepCr} cristal` : ''}`)
      if (leaving.length) {
        c = withTreasury(c, { prestige: -10 * leaving.length }, `${title} : soldats non payés`)
        lines.push(`Non payés, quittent la bande : ${leaving.map((mid) => nameOf(faction!, memberById(mid))).join(', ')} (-${10 * leaving.length} prestige)`)
      }
      const leavers = c.members.filter((m) => isActive(m) && (leaving.includes(m.id) || m.leavesAfterGame))
      for (const m of leavers.filter((m) => m.leavesAfterGame)) lines.push(`${nameOf(faction!, m)} quitte la bande (blessure)`)
      c = { ...c, members: c.members.map((m) => (leavers.some((l) => l.id === m.id) ? { ...m, status: 'parti' as const, leavesAfterGame: false } : m)) }
    }
    if (k === S.xp) {
      c = {
        ...c,
        members: c.members.map((m) => {
          const p = profileOf(faction!, m)
          if (!p || !participants.includes(m.id) || !isActive(m)) return m
          const gain = xpTotal(m.id)
          if (!gain || learnsNothing(p, m)) return m
          lines.push(`${nameOf(faction!, m)} : +${gain} XP`)
          return addXp(p, m, gain)
        }),
      }
    }
    return { crew: c, lines }
  }

  function goNext() {
    const { crew, lines } = applyStep(step, draft!)
    setExits((e) => { const n = [...e]; n[step] = draft!; return n })
    setLogs((all) => all.map((l, i) => (i === step ? [...l.filter((x) => !x.startsWith('§')), ...lines.map((x) => `§${x}`)] : i > step ? [] : l)))
    setDraft(crew)
    setStep(step + 1)
    window.scrollTo(0, 0)
  }

  function goBack() {
    setDraft(exits[step - 1])
    setLogs((all) => all.map((l, i) => (i === step - 1 ? l.filter((x) => !x.startsWith('§')) : i >= step ? [] : l)))
    setStep(step - 1)
    window.scrollTo(0, 0)
  }

  async function finish() {
    setSaving(true)
    const allLines = logs.flat().map((l) => l.replace(/^§/, ''))
    const game = { id: newId(), date: new Date().toISOString(), title, participants, lines: allLines }
    // Ceux qui ont manqué cette partie pour blessure grave pourront jouer la suivante.
    const members = draft!.members
      .map((m) => (original!.members.find((o) => o.id === m.id)?.missNextGame && !participants.includes(m.id) ? { ...m, missNextGame: false } : m))
      // La partie est finie : les objets ne sont plus « trouvés pendant la partie ».
      .map((m) => ({
        ...m,
        equipment: m.equipment.map((ref) => ({ ...ref, found: undefined })),
        loot: m.loot?.map((ref) => ({ ...ref, found: undefined })),
      }))
    const final: Crew = {
      ...draft!,
      members,
      campaign: { ...draft!.campaign!, games: [...draft!.campaign!.games, game], currentGame: undefined },
    }
    await saveCrew(final)
    // Phase de nuit : ce bilan devient le rapport de fin de nuit de la bande.
    await submitSheetIfNeeded(final, allLines).catch(() => false)
    try {
      localStorage.removeItem(wizardKey(final.id))
    } catch {
      // ignoré
    }
    navigate(final.groupCampaign ? `/campagnes/${final.groupCampaign.id}` : `/bandes/${final.id}`)
  }

  const giveItem = (m: Member, pick: LootPick) => {
    const name = memberName(m) || profileOf(faction, m)?.name
    if (pick.kind === 'loot') {
      setMember({ ...m, loot: [...(m.loot ?? []), { id: newId(), key: pick.key, slot: 'sac' }] })
      log(`${name} récupère : ${itemByKey(pick.key)?.name ?? pick.key}${pick.paid ? ` (acheté ${pick.price} PO)` : ''}`)
    } else {
      setMember({ ...m, equipment: [...m.equipment, { itemId: pick.itemId, slot: 'sac' }] })
      log(`${name} récupère : ${equipmentById(pick.itemId)?.name ?? pick.itemId}${pick.paid ? ` (acheté ${pick.price} PO)` : ''}`)
    }
    if (pick.paid) setDraft((d) => d && withTreasury(d, { po: -pick.price }, `${title} : achat`))
    setLootFor(null)
  }

  /** Cartes Marché noir en plus : une par figurine avec Soldat de la Pègre. */
  const pegre = draft.members.filter((m) => {
    const p = isActive(m) ? profileOf(faction, m) : undefined
    return !!p && memberSkills(p, m).some((sk) => sk.toLowerCase() === 'soldat de la pègre')
  }).length
  /** Partie notée en direct : ses objets ramassés sont mis en avant dans l'étape Butin. */
  const liveGame = original.campaign.currentGame
  const foundInGame = (m: Member, flag: string | undefined, name: string) =>
    !!liveGame && (flag === liveGame.id || liveGame.events.some((e) => e.step === 'loot' && e.text === `${nameOf(faction, m)} ramasse : ${name}`))
  const lootLines = (m: Member) => {
    const all = [
      ...m.equipment.map((ref, i) => ({ key: `e${i}`, kind: 'equipment' as const, ref: i as string | number, name: equipmentById(ref.itemId)?.name ?? ref.itemId, price: equipmentById(ref.itemId)?.price ?? null, loot: false, found: foundInGame(m, ref.found, equipmentById(ref.itemId)?.name ?? ref.itemId) })),
      ...(m.loot ?? []).map((l) => ({ key: l.id, kind: 'loot' as const, ref: l.id as string | number, name: itemByKey(l.key)?.name ?? l.key, price: itemByKey(l.key)?.price ?? null, loot: true, found: foundInGame(m, l.found, itemByKey(l.key)?.name ?? l.key) })),
    ]
    const tag = (it: (typeof all)[number]) => (
      <span key={it.key} className="tag-wrap with-after">
        <span className={`tag ${it.loot ? 'loot-tag' : ''} ${it.found ? 'found-tag' : ''}`}>{it.name}</span>
        {it.price ? (
          <button className="tag-remove tag-sell" onClick={() => sellItem(m, it.kind, it.ref, it.name, it.price!)} aria-label={`Vendre ${it.name}`} data-tip={`Vendre pour ${Math.floor(it.price / 2)} PO`}>
            {Math.floor(it.price / 2)} PO
          </button>
        ) : null}
        <button className="tag-remove" onClick={() => loseItem(m, it.kind, it.ref, it.name)} aria-label={`Perdre ${it.name}`} data-tip="Perdre l'objet (dépouillé, détruit…)">×</button>
      </span>
    )
    const found = all.filter((it) => it.found)
    const others = all.filter((it) => !it.found)
    if (!all.length) return null
    return (
      <div className="step-tags loot-lines">
        {liveGame && (
          <p className="small">
            <strong>Trouvé pendant la partie :</strong>{' '}
            {found.length ? <span className="tags">{found.map(tag)}</span> : <span className="muted">rien</span>}
          </p>
        )}
        {others.length > 0 && (
          <p className="small">
            <span className="muted">{liveGame ? 'Déjà sur la figurine :' : 'Objets :'}</span> <span className="tags">{others.map(tag)}</span>
          </p>
        )}
      </div>
    )
  }

  /** Participants déjà choisis (partie notée en direct) : l'étape « Qui a participé ? » est sautée. */
  const preset = !!original?.campaign?.currentGame
  const levelers = draft.members.filter((m) => isActive(m) && pendingLevels(m) > 0)
  const usedEntries = draft.members.filter(isActive).flatMap((m) => lootItems(m).filter(({ ref }) => ref.used).map((e) => ({ m, ...e })))
  const missingCrystalRoll = step === S.loot && diceCount > 0 && Array.from({ length: diceCount }, (_, i) => rolls[i] ?? null).some((r) => r === null)
  const missingPoisonRoll = step === S.items && usedEntries.some(({ ref, item }) => item?.consumable === 'poison' && (poisonRolls[ref.id] ?? null) === null)
  const deficit = treasury.po - upkeepPo
  const crDeficit = treasury.cristaux - upkeepCr
  const learners = alivePlaying.filter((m) => {
    const p = profileOf(faction, m)
    return p && !learnsNothing(p, m)
  })
  /** Ce qui empêche de passer à l'étape suivante (null : rien). */
  const blockReason: string | null =
    step === S.participants && participants.length === 0 ? 'Choisissez au moins une figurine.'
      : missingPoisonRoll ? 'Lancez le dé de chaque poison utilisé.'
        : missingCrystalRoll ? 'Lancez tous les dés des cristaux bruts.'
          : step === S.upkeep && deficit < 0 ? `Il manque ${-deficit} PO pour payer l'entretien : vendez des objets ou des cristaux, ou laissez partir des soldats.`
            : step === S.upkeep && crDeficit < 0 ? `Il manque ${-crDeficit} cristal(aux) pour l'entretien.`
              : step === S.xp && learners.some((m) => (xp[m.id]?.participation ?? null) === null) ? `Lancez le dé de participation de : ${learners.filter((m) => (xp[m.id]?.participation ?? null) === null).map((m) => nameOf(faction, m)).join(', ')}.`
                : step === S.xp && learners.some((m) => liqueurDice[m.id] && xp[m.id]?.liqueur === undefined) ? 'Lancez les dés de liqueur.'
                  : step === S.levels && levelers.length > 0 ? `Appliquez les montées de niveau de : ${levelers.map((m) => nameOf(faction, m)).join(', ')}.`
                    : null

  return (
    <section className="after-battle">
      <nav className="crumbs">
        <Link to="/bandes">Mes bandes</Link> <span>›</span> <Link to={`/bandes/${original.id}`}>{original.name || 'Bande'}</Link> <span>›</span> Après la bataille
      </nav>
      <header className="step-head">
        <div>
          <h1>Après la bataille</h1>
          <p className="step-sub">{original.name} · {treasury.po} PO · {treasury.cristaux} cristaux · {treasury.prestige} prestige</p>
        </div>
      </header>

      {resumed && (
        <p className="notice small row wrap between">
          <span>Assistant repris là où vous l'aviez laissé.</span>
          <button className="btn small" onClick={() => { setResumed(false); startFrom(original) }}>Recommencer depuis le début</button>
        </p>
      )}
      {preset && step === S.items && !resumed && (
        <p className="notice small">
          Les informations notées pendant « {original.campaign.currentGame!.title} » sont déjà reprises : cristaux, PO, objets et compteurs d'XP.
          <br />Participants : {participants.map((mid) => nameOf(faction, memberById(mid))).join(', ')}.
        </p>
      )}

      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''} data-tip={preset && i === S.participants ? 'Choisis pendant la préparation de la journée.' : undefined}><span>{i + 1}</span> {s}</li>
        ))}
      </ol>

      <div className="card step-card">
        {step === S.participants && (
          <>
            <h2>Qui a participé ?</h2>
            <label className="field">
              <span>Nom de la partie</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <p className="muted small">10 figurines au maximum sur la table. Les blessés graves manquent cette partie.</p>
            <ul className="check-list">
              {draft.members.filter(isActive).map((m) => {
                const on = participants.includes(m.id)
                return (
                  <li key={m.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!on && participants.length >= 10}
                        onChange={() => setParticipants((ps) => (on ? ps.filter((x) => x !== m.id) : [...ps, m.id]))}
                      />
                      <strong>{nameOf(faction, m)}</strong> <span className="muted small">{profileOf(faction, m)?.name} · niv. {m.level}</span>
                      {m.missNextGame && <span className="badge ko">Blessure grave</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {step === S.items && (
          <>
            <h2>Objets utilisés</h2>
            <p className="muted small">
              Potions et objets à usage unique utilisés pendant la partie : ils sont défaussés. Poisons : jet de réserve, le poison est
              perdu sur un résultat inférieur ou égal au seuil (8, 5 avec Toxine apprivoisée, 3 avec une sarbacane).
            </p>
            {usedEntries.length === 0 && (
              <p className="notice small">Aucun objet utilisé. Marquez-les avec le bouton « Utiliser » dans le builder pendant la partie.</p>
            )}
            <ul className="member-steps">
              {usedEntries.map(({ m, ref, item }) => {
                const p = profileOf(faction, m)
                const threshold = p ? poisonThreshold(p, m) : 8
                const roll = poisonRolls[ref.id] ?? null
                return (
                  <li key={ref.id}>
                    <span><strong>{nameOf(faction, m)}</strong> : {item?.name ?? ref.key}</span>
                    {item?.consumable === 'poison' ? (
                      <span className="poison-row">
                        <span className="muted small">perdu sur {threshold} ou moins</span>
                        <DiceInput value={roll} onChange={(v) => setPoisonRolls((r) => ({ ...r, [ref.id]: v }))} />
                        {roll !== null && <span className={`badge ${roll > threshold ? 'ok' : 'ko'}`}>{roll > threshold ? 'Conservé' : 'Épuisé'}</span>}
                      </span>
                    ) : (
                      <span className="badge ko">Défaussé{item?.xpDice ? ` · +${item.xpDice}D10 XP` : ''}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {step === S.injuries && (
          <>
            <h2>Morts et blessures</h2>
            <p className="muted small">
              Pour chaque figurine mise hors de combat, appliquez la carte Blessure piochée. Les figurines mortes perdent leur équipement.
            </p>
            <ul className="member-steps">
              {playing.map((m) => (
                <li key={m.id} className={isActive(m) ? '' : 'dead'}>
                  <span><strong>{nameOf(faction, m)}</strong> {!isActive(m) && <span className="badge ko">Mort</span>}</span>
                  <span className="muted small">{(m.injuries ?? []).filter((r) => !original.members.find((o) => o.id === m.id)?.injuries?.some((x) => x.id === r.id)).length} nouvelle(s) blessure(s)</span>
                  {isActive(m) && <button className="btn small" onClick={() => setInjuryFor(m.id)}>✚ Blessure</button>}
                  {(m.injuries ?? []).length > 0 && (
                    <span className="tags step-tags">
                      {(m.injuries ?? []).map((r) => (
                        <span key={r.id} className="tag-wrap with-after">
                          <span className="tag injury-tag">{injuryById(r.cardId)?.name ?? r.cardId}</span>
                          <button className="tag-remove" onClick={() => removeInjury(m, r.id)} aria-label="Retirer cette blessure" data-tip="Retirer cette blessure (erreur)">×</button>
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <StepLog lines={logs[S.injuries]} />
          </>
        )}

        {step === S.loot && (
          <>
            <h2>Butin</h2>
            <h3>Cristaux bruts</h3>
            <div className="row wrap">
              <label className="field narrow">
                <span>Cristaux bruts</span>
                <input type="number" min={0} value={rawCrystals} onChange={(e) => { const n = Math.max(0, Number(e.target.value)); setRawCrystals(n); setRolls(Array(n ? n + prospectors : 0).fill(null)) }} />
              </label>
              {diceCount > 0 && <button className="btn small" onClick={() => setRolls(Array.from({ length: diceCount }, () => d10()))}>🎲 Tout lancer</button>}
            </div>
            {prospectors > 0 && rawCrystals > 0 && (
              <p className="muted small">Prospection : {prospectors} dé(s) en plus, seuls les {rawCrystals} meilleurs résultats comptent.</p>
            )}
            {diceCount > 0 && (
              <div className="dice-row">
                {Array.from({ length: diceCount }, (_, i) => (
                  <DiceInput key={i} value={rolls[i] ?? null} onChange={(v) => setRolls((r) => { const n = [...r]; n[i] = v; return n })} label={`Dé ${i + 1}`} />
                ))}
              </div>
            )}
            {rawCrystals > 0 && <p><strong>{crystalsGained}</strong> cristaux magiques obtenus.</p>}
            {crystalsGained > 0 && !missingCrystalRoll && (
              <div className="row wrap crystal-sale">
                <label className="row">
                  Vendre
                  <input
                    type="number"
                    min={0}
                    max={crystalsGained}
                    className="xp-input"
                    value={Math.min(crystalsSold, crystalsGained)}
                    onChange={(e) => setCrystalsSold(Math.max(0, Math.min(crystalsGained, Math.floor(Number(e.target.value) || 0))))}
                    aria-label="Cristaux à vendre"
                  />
                  cristal(aux) sur {crystalsGained}, à {CRYSTAL_PRICE} PO pièce
                </label>
                {crystalsSold > 0 && <strong>+{Math.min(crystalsSold, crystalsGained) * CRYSTAL_PRICE} PO</strong>}
                <span className="muted small">Vous en garderez {crystalsGained - Math.min(crystalsSold, crystalsGained)}.</span>
              </div>
            )}
            {missingCrystalRoll && <p className="notice small">Lancez tous les dés des cristaux bruts pour continuer.</p>}

            <h3>Or et prestige</h3>
            <div className="row wrap">
              <label className="field narrow"><span>PO trouvées</span><input type="number" value={poFound} onChange={(e) => setPoFound(Number(e.target.value))} /></label>
              <label className="field narrow"><span>Prestige gagné</span><input type="number" value={prestigeGained} onChange={(e) => setPrestigeGained(Number(e.target.value))} /></label>
            </div>

            <h3>Objets trouvés</h3>
            <ul className="member-steps">
              {alivePlaying.map((m) => (
                <li key={m.id}>
                  <strong>{nameOf(faction, m)}</strong>
                  <button className="btn small" onClick={() => setLootFor(m.id)}>⚱ Donner un objet</button>
                  {lootLines(m)}
                </li>
              ))}
            </ul>
            <h3>Marché noir</h3>
            {!market ? (
              <div className="row wrap">
                <button className="btn" onClick={() => setMarket(drawMarket(4 + pegre))}>🂠 Tirer {4 + pegre} cartes Marché noir</button>
                <span className="muted small">4 cartes{pegre ? `, +${pegre} pour Soldat de la Pègre` : ''}. Les cartes non achetées retournent dans le paquet.</span>
              </div>
            ) : (
              <>
                <p className="muted small">Trésor actuel : {draft.campaign?.po ?? 0} PO{poFound ? ` (+${poFound} PO trouvées, ajoutées à la fin du bilan)` : ''}.</p>
                <ul className="market-list">
                  {market.map((key, i) => {
                    const item = itemByKey(key)
                    const bought = marketBought.includes(i)
                    const price = item?.price ?? null
                    return (
                      <li key={i} className={bought ? 'bought' : ''}>
                        <div>
                          <strong><RarityDot rarity={item?.rarity ?? 'blanc'} /> {item?.name ?? key}</strong>{' '}
                          <span className="muted small">{price !== null ? `${price} PO` : 'prix inconnu'}</span>
                          {item?.description && <p className="small"><RuleText text={item.description} /></p>}
                        </div>
                        {bought ? (
                          <span className="badge ok">✓ Acheté</span>
                        ) : (
                          <div className="row">
                            <select value={buyer[i] ?? alivePlaying[0]?.id ?? ''} onChange={(e) => setBuyer((b) => ({ ...b, [i]: e.target.value }))} aria-label="Figurine qui reçoit l'objet">
                              {alivePlaying.map((m) => <option key={m.id} value={m.id}>{nameOf(faction, m)}</option>)}
                            </select>
                            <button className="btn small primary" disabled={price === null || !alivePlaying.length} onClick={() => buyMarket(i)}>Acheter</button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            <StepLog lines={logs[S.loot]} />
          </>
        )}

        {step === S.upkeep && (
          <>
            <h2>Entretien</h2>
            <p>
              Solde à payer : <strong>{upkeepPo} PO</strong>{upkeepCr ? <> et <strong>{upkeepCr} cristal</strong></> : null} · trésor : {treasury.po} PO, {treasury.cristaux} cristaux.
            </p>
            {deficit < 0 && (
              <div className="notice">
                Il manque {-deficit} PO.{' '}
                {treasury.cristaux > 0 && (
                  <button
                    className="btn small"
                    onClick={() => {
                      const n = Math.min(treasury.cristaux, Math.ceil(-deficit / CRYSTAL_PRICE))
                      setDraft(withTreasury(draft, { cristaux: -n, po: n * CRYSTAL_PRICE }, `${title} : vente de ${n} cristaux`))
                      log(`Vente de ${n} cristaux (${n * CRYSTAL_PRICE} PO)`)
                    }}
                  >
                    Vendre des cristaux
                  </button>
                )}{' '}
                Sinon, décochez les soldats qui ne sont pas payés : ils quittent la bande (-10 prestige chacun).
              </div>
            )}
            {crDeficit < 0 && <p className="notice">Il manque {-crDeficit} cristal pour l'entretien en cristaux.</p>}
            <p className="muted small">Cochés : entretien payé, le soldat reste. Le chef ne coûte rien.</p>
            <ul className="check-list">
              {draft.members.filter(isActive).map((m) => {
                const p = profileOf(faction, m)
                const u = memberUpkeep(p, m)
                const on = leaving.includes(m.id)
                return (
                  <li key={m.id}>
                    <label>
                      <input type="checkbox" checked={!on} disabled={isChef(p, m)} onChange={() => setLeaving((l) => (on ? l.filter((x) => x !== m.id) : [...l, m.id]))} aria-label={`Entretien payé : ${nameOf(faction, m)}`} />
                      <strong>{nameOf(faction, m)}</strong>{' '}
                      <span className="muted small">{u.cristaux ? `${u.cristaux} cristal` : `${u.po} PO`}{on ? ' · non payé, quitte la bande' : ' · payé'}</span>
                      {m.leavesAfterGame && <span className="badge ko">Part après la partie</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
            <StepLog lines={logs[S.upkeep]} />
          </>
        )}

        {step === S.xp && (
          <>
            <h2>Expérience</h2>
            <p className="muted small">
              Participation : 1D10 · lieu d'intérêt fouillé : 5 XP · points de vie retirés : 2 à 10 XP chacun selon la figurine (« XP apporté »)
              · ennemi tué : 5 XP.
            </p>
            <div className="table-wrap">
              <table className="ref-table xp-table">
                <thead>
                  <tr><th>Figurine</th><th>Participation</th><th>Lieux fouillés</th><th>XP de PV retirés</th><th>Ennemis tués</th>{hasLiqueur && <th>Liqueur</th>}<th>Total</th></tr>
                </thead>
                <tbody>
                  {alivePlaying.map((m) => {
                    const p = profileOf(faction, m)
                    const v = xp[m.id] ?? { participation: null, places: 0, damage: 0, kills: 0 }
                    const set = (patch: Partial<XpInput>) => setXp((all) => ({ ...all, [m.id]: { ...v, ...patch } }))
                    if (p && learnsNothing(p, m)) {
                      return <tr key={m.id}><td><strong>{nameOf(faction, m)}</strong></td><td colSpan={hasLiqueur ? 6 : 5} className="muted">N'apprend rien</td></tr>
                    }
                    return (
                      <tr key={m.id}>
                        <td><strong>{nameOf(faction, m)}</strong><br /><span className="muted small">{m.xp} XP</span></td>
                        <td><DiceInput value={v.participation} onChange={(r) => set({ participation: r })} /></td>
                        <td><input type="number" min={0} className="xp-input" value={v.places} onChange={(e) => set({ places: Number(e.target.value) })} /></td>
                        <td><input type="number" min={0} className="xp-input" value={v.damage} onChange={(e) => set({ damage: Number(e.target.value) })} /></td>
                        <td><input type="number" min={0} className="xp-input" value={v.kills} onChange={(e) => set({ kills: Number(e.target.value) })} /></td>
                        {hasLiqueur && (
                          <td>
                            {liqueurDice[m.id] ? (
                              <span className="dice-input">
                                <input type="number" min={0} className="xp-input" value={v.liqueur ?? ''} placeholder={`${liqueurDice[m.id]}D10`} onChange={(e) => set({ liqueur: Number(e.target.value) })} aria-label="XP de liqueur" />
                                <button type="button" className="btn small" onClick={() => set({ liqueur: Array.from({ length: liqueurDice[m.id] }, d10).reduce((a, b) => a + b, 0) })} title="Lancer les dés">🎲</button>
                              </span>
                            ) : '—'}
                          </td>
                        )}
                        <td><strong>+{xpTotal(m.id)}</strong></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="btn small"
              onClick={() => setXp((all) => {
                const n = { ...all }
                for (const m of alivePlaying) n[m.id] = { ...(n[m.id] ?? { places: 0, damage: 0, kills: 0 }), participation: n[m.id]?.participation ?? d10() }
                return n
              })}
            >
              🎲 Lancer toutes les participations
            </button>
          </>
        )}

        {step === S.levels && (
          <>
            <h2>Montées de niveau</h2>
            {levelers.length === 0 && <p className="muted">Aucune figurine ne change de niveau.</p>}
            {levelers.map((m) => {
              const p = profileOf(faction, m)!
              return (
                <div key={m.id} className="leveler">
                  <h3>{nameOf(faction, m)} <span className="muted small">{m.xp} XP · {pendingLevels(m)} niveau(x) à appliquer</span></h3>
                  <AdvancePicker
                    key={`${m.id}-${m.level}`}
                    factionId={faction.id}
                    profile={p}
                    member={m}
                    onApply={(input) => {
                      const updated = applyAdvance(m, input)
                      setMember(updated)
                      log(`${nameOf(faction, m)} passe niveau ${updated.level} : ${updated.advances!.slice(-1)[0].label}`)
                    }}
                  />
                </div>
              )
            })}
            <StepLog lines={logs[S.levels]} />
          </>
        )}

        {step === S.summary && (
          <>
            <h2>Résumé : {title}</h2>
            <ul className="summary">
              {logs.flat().map((l, i) => <li key={i}>{l.replace(/^§/, '')}</li>)}
              {logs.flat().length === 0 && <li className="muted">Rien à signaler.</li>}
            </ul>
            <p>Trésor après la partie : <strong>{treasury.po} PO</strong>, {treasury.cristaux} cristaux, {treasury.prestige} prestige.</p>
            <p className="muted small">Ensuite, achetez et vendez de l'équipement ou recrutez depuis le builder.</p>
          </>
        )}
      </div>

      <div className="row between step-nav">
        {step > (preset ? S.items : 0) ? (
          <button className="btn" onClick={goBack}>← Précédent</button>
        ) : (
          <Link className="btn ghost" to={original.groupCampaign ? `/campagnes/${original.groupCampaign.id}` : `/bandes/${original.id}`}>Annuler</Link>
        )}
        {step < STEPS.length - 1 ? (
          <span className="row step-next">
            {blockReason && <span className="muted small step-block">{blockReason}</span>}
            <button className="btn primary" onClick={goNext} disabled={!!blockReason}>
              Suivant →
            </button>
          </span>
        ) : (
          <button className="btn primary" onClick={finish} disabled={saving}>Enregistrer la partie</button>
        )}
      </div>

      <Modal open={!!injuryFor} title={`Blessure : ${injuryFor ? nameOf(faction, memberById(injuryFor)) : ''}`} kicker="Paquet Blessure" onClose={() => setInjuryFor(null)} noFooter>
        {injuryFor && (
          <InjuryPicker
            onClose={() => setInjuryFor(null)}
            lastingOnly
            onApply={(card) => {
              const m = memberById(injuryFor)
              const res = applyInjury(m, card)
              setMember(res.member)
              log(`${nameOf(faction, m)} : ${card.name}${res.messages.length && card.lasting ? ` (${res.messages.join(' ')})` : ''}`)
              if (!card.special) setInjuryFor(null)
            }}
            onNegotiate={() => {
              const m = memberById(injuryFor)
              setDraft(withTreasury(draft, { po: -20 }, `${title} : négociation avec la mort`))
              log(`${nameOf(faction, m)} : négociation avec la mort, 20 PO payés`)
              setInjuryFor(null)
            }}
          />
        )}
      </Modal>
      <Modal open={!!lootFor} title={`Objet trouvé : ${lootFor ? nameOf(faction, memberById(lootFor)) : ''}`} onClose={() => setLootFor(null)} noFooter>
        {lootFor && (
          <LootPicker
            onClose={() => setLootFor(null)}
            // Objet trouvé en fouillant : il va dans le sac, même si la figurine ne peut pas s'en servir.
            allowedEquipment={null}
            onPick={(pick) => giveItem(memberById(lootFor), pick)}
          />
        )}
      </Modal>
    </section>
  )
}

function StepLog({ lines }: { lines: string[] }) {
  const shown = lines.filter((l) => !l.startsWith('§'))
  if (!shown.length) return null
  return (
    <ul className="step-log">
      {shown.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  )
}
