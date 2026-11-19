import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { equipmentById, factionById, injuryById, itemByKey, itemCategories, itemKey, spellById, type Faction } from '../data'
import { memberTitle,
  CRYSTAL_PRICE,
  isActive,
  isChef,
  lootItems,
  memberSkills,
  memberUpkeep,
  newId,
  profileOf,
  withTreasury,
  leaveCrew,
  crewPath,
  type Crew,
  type Member,
  memberName,
  crystalWord
} from '../lib/crew'
import { addXp, applyAdvance, applyInjury, d10, revertInjury, learnsNothing, pendingLevels, poisonThreshold } from '../lib/campaign'
import { getCrew, saveCrew } from '../lib/storage'
import { reportDraftKey } from '../lib/reportDraft'
import DiceInput from '../components/DiceInput'
import Counter from '../components/Counter'
import NumberInput from '../components/NumberInput'
import ItemChip from '../components/ItemChip'
import Modal from '../components/Modal'
import InjuryPicker from '../components/InjuryPicker'
import AdvancePicker from '../components/AdvancePicker'
import LootPicker, { type LootPick } from '../components/LootPicker'
import { getMyEntry, loadCrewWithGifts, sendGifts, submitSheetIfNeeded } from '../lib/groupCampaign'
import { DECKS } from '../lib/decks'
import { type PlannedGift } from '../lib/trade'
import { clearLockedPrefix, getLocked, setLocked } from '../lib/lockedRolls'
import RarityDot from '../components/RarityDot'
import RuleText from '../components/RuleText'

// Le commerce se fait hors du rapport, depuis la page de la campagne (avant ou après).
const STEPS = ['Participants', 'Objets utilisés', 'Morts et blessures', 'Butin', 'Entretien', 'Expérience', 'Niveaux', 'Résumé']
// Index des étapes.
const S = { participants: 0, items: 1, injuries: 2, loot: 3, upkeep: 4, xp: 5, levels: 6, summary: 7 }
/** Ancienne étape Commerce (5e étape) des brouillons enregistrés avant son retrait. */
const OLD_TRADE = 4

interface XpInput {
  participation: number | null
  places: number
  damage: number
  kills: number
  liqueur?: number
}

/** Destination « coffre du camp » dans la liste des acheteurs du marché noir. */
const TO_STOCK = '__coffre'

/** Marque des objets notés comme trouvés dans le bilan lui-même. */
const FOUND_IN_REPORT = 'bilan'

const nameOf = (faction: Faction, m: Member) => memberTitle(faction, m)

// Brouillon de l'assistant conservé dans le navigateur, pour reprendre là où on s'était arrêté.
const wizardKey = reportDraftKey

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
  /** Cristaux du butin vendus tout de suite (CRYSTAL_PRICE pièce). */
  crystalsSold?: number
  /** Membres dont l'entretien est annulé pour cette partie (Vampire qui a mordu). */
  waived?: string[]
  /** Couronne sauteuse : la bande la porte, et les 2 cartes Trésor reçues. */
  crown?: boolean
  crownCards?: string[]
  /** Envois à d'autres joueurs (ancienne étape Commerce : déjà retirés de la bande, envoyés à l'enregistrement). */
  gifts?: PlannedGift[]
  /** 2 : sans l'étape Commerce. */
  v?: number
}


/** Objets du paquet Marché noir, par catégorie : pour noter les cartes piochées à la table. */
const MARKET_CHOICES = (() => {
  const refs = new Set((DECKS.find((d) => d.id === 'marche-noir')?.cards ?? []).map((c) => c.ref))
  return itemCategories
    .map((c) => ({ name: c.name, items: c.items.filter((it) => refs.has(itemKey(c.id, it.id))).map((it) => ({ key: itemKey(c.id, it.id), name: it.name, price: it.price })) }))
    .filter((c) => c.items.length)
})()

/** Objets du paquet Trésor, par catégorie (couronne sauteuse). */
const TREASURE_CHOICES = (() => {
  const refs = new Set((DECKS.find((d) => d.id === 'objets')?.cards ?? []).map((c) => c.ref))
  return itemCategories
    .map((c) => ({ name: c.name, items: c.items.filter((it) => refs.has(itemKey(c.id, it.id))).map((it) => ({ key: itemKey(c.id, it.id), name: it.name })) }))
    .filter((c) => c.items.length)
})()

/** Cartes tirées au hasard dans le paquet Trésor (exemplaires compris). */
function drawTreasure(count: number): string[] {
  const deck = [...(DECKS.find((d) => d.id === 'objets')?.cards ?? [])]
  const out: string[] = []
  while (out.length < count && deck.length) out.push(deck.splice(Math.floor(Math.random() * deck.length), 1)[0].ref)
  return out
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
    const snap = JSON.parse(localStorage.getItem(wizardKey(crewId)) ?? 'null') as WizardSnapshot | null
    return snap && !snap.v ? withoutTradeStep(snap) : snap
  } catch {
    return null
  }
}

/**
 * Brouillon commencé avec l'étape Commerce : on la retire sans rien perdre.
 * Arrêté sur le Commerce : ses envois n'étaient pas encore appliqués, ils sont abandonnés (à refaire hors du rapport).
 * Plus loin : les envois sont déjà retirés de la bande, ils restent et partent à l'enregistrement.
 */
function withoutTradeStep(snap: WizardSnapshot): WizardSnapshot {
  const logs = snap.logs.length > OLD_TRADE
    ? [...snap.logs.slice(0, S.loot), [...snap.logs[S.loot], ...snap.logs[OLD_TRADE]], ...snap.logs.slice(OLD_TRADE + 1)]
    : snap.logs
  if (snap.step <= OLD_TRADE) return { ...snap, v: 2, logs, gifts: [] }
  return { ...snap, v: 2, logs, step: snap.step - 1, exits: snap.exits.filter((_, i) => i !== OLD_TRADE) }
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
  const [crown, setCrown] = useState(false)
  const [waived, setWaived] = useState<string[]>([])
  const [crownCards, setCrownCards] = useState<string[]>([])
  // Commerce
  const [gifts, setGifts] = useState<PlannedGift[]>([])
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
  /** Relance le chargement (envois reçus pendant le rapport). */
  const [reload, setReload] = useState(0)
  const [checking, setChecking] = useState(false)
  const [mailInfo, setMailInfo] = useState<string | null>(null)
  const receivedBefore = useRef(0)

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
    setCrownCards([])
    setGifts([])
    setWaived([])
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

  // Campagne de groupe : la couronne sauteuse est pré-cochée si le joueur a indiqué la porter.
  useEffect(() => {
    if (!original?.groupCampaign) return
    if (readSnapshot(original.id)?.crown !== undefined) return
    getMyEntry(original.groupCampaign.id).then((e) => setCrown(!!e?.crown)).catch(() => {})
  }, [original])

  useEffect(() => {
    // Les envois reçus sont ajoutés à la bande et au brouillon du rapport avant de le reprendre.
    loadCrewWithGifts(id!).then((c) => {
      setChecking((was) => {
        if (was) {
          const n = (c?.campaign?.receivedGifts?.length ?? 0) - receivedBefore.current
          setMailInfo(n > 0 ? `${n} envoi${n > 1 ? 's' : ''} reçu${n > 1 ? 's' : ''} : ajouté${n > 1 ? 's' : ''} au trésor et au coffre du camp.` : 'Aucun nouvel envoi.')
        }
        return false
      })
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
        if (snap.crown !== undefined) setCrown(snap.crown)
        setCrownCards(snap.crownCards ?? [])
        setGifts(snap.gifts ?? [])
        setWaived(snap.waived ?? [])
        setResumed(snap.step > 0)
      } else {
        startFrom(c)
      }
    }).catch(() => setOriginal(null))
  }, [id, reload])

  // Téléphone : la frise des étapes défile pour garder l'étape en cours visible.
  useEffect(() => {
    document.querySelector('.stepper li.on')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [step])

  // Enregistre le brouillon à chaque changement.
  useEffect(() => {
    if (!original || !draft || saving) return
    const snap: WizardSnapshot = {
      base: original.updatedAt, step, draft, exits, logs, title, participants, rawCrystals, rolls,
      poFound, prestigeGained, leaving, poisonRolls, xp, liqueurDice, market: market ?? undefined, marketBought, crystalsSold, crown, crownCards, gifts, waived, v: 2,
    }
    try {
      localStorage.setItem(wizardKey(original.id), JSON.stringify(snap))
    } catch {
      // Stockage indisponible (navigation privée…) : l'assistant marche quand même, sans reprise.
    }
  }, [original, draft, step, exits, logs, title, participants, rawCrystals, rolls, poFound, prestigeGained, leaving, poisonRolls, xp, liqueurDice, market, marketBought, crystalsSold, crown, crownCards, gifts, waived, saving])

  if (original === undefined) return <p className="muted">Chargement…</p>
  const faction = original ? factionById(original.factionId) : undefined
  if (!original || !draft || !faction) return <p className="error">Bande introuvable. <Link to="/bandes">Retour</Link></p>
  if (!original.campaign) {
    return (
      <p className="notice">
        La campagne n'a pas encore commencé pour cette bande. <Link to={crewPath(original)}>Retour au builder</Link>
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
  /** Retire une carte non achetée (indices des cartes achetées et acheteurs décalés). */
  const removeMarketCard = (index: number) => {
    setMarket((m) => (m ?? []).filter((_, i) => i !== index))
    setMarketBought((b) => b.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)))
    setBuyer((all) => Object.fromEntries(Object.entries(all).filter(([k]) => Number(k) !== index).map(([k, v]) => [Number(k) > index ? Number(k) - 1 : Number(k), v])))
  }
  const buyMarket = (index: number) => {
    const key = market?.[index]
    const item = key ? itemByKey(key) : undefined
    const target = buyer[index] ?? alivePlaying[0]?.id ?? TO_STOCK
    const m = draft.members.find((x) => x.id === target)
    if (!key || !item || item.price === null || (target !== TO_STOCK && !m)) return
    const price = item.price
    const ref = { id: newId(), key, slot: 'sac' as const }
    setDraft((d) => {
      if (!d?.campaign) return d
      // Envoyé au coffre du camp, ou dans le sac du personnage choisi.
      const next =
        target === TO_STOCK
          ? { ...d, campaign: { ...d.campaign, stock: { equipment: d.campaign.stock?.equipment ?? [], loot: [...(d.campaign.stock?.loot ?? []), ref] } } }
          : { ...d, members: d.members.map((x) => (x.id === target ? { ...x, loot: [...(x.loot ?? []), ref] } : x)) }
      return withTreasury(next, { po: -price }, `${title} : marché noir, ${item.name}`)
    })
    setMarketBought((b) => [...b, index])
    log(`Marché noir : ${item.name} acheté ${m ? `pour ${nameOf(faction, m)}` : 'pour le coffre du camp'} (${price} PO)`)
  }
  const loseItem = (m: Member, kind: 'equipment' | 'loot', ref: string | number, name: string) => {
    if (!confirm(`${nameOf(faction, m)} perd « ${name} » ? L'objet quitte la bande.`)) return
    setMember(kind === 'loot' ? { ...m, loot: (m.loot ?? []).filter((l) => l.id !== ref) } : { ...m, equipment: m.equipment.filter((_, i) => i !== ref) })
    const who = memberName(m) || profileOf(faction, m)?.name
    unlog(`${who} récupère : ${name}`, `${nameOf(faction, m)} perd : ${name}`)
  }
  const playing = participants.map(memberById).filter(Boolean)
  const alivePlaying = playing.filter(isActive)
  // Plus de transformation des cristaux bruts : chaque cristal ramassé est un cristal magique.
  const crystalsGained = rawCrystals
  /** Cristaux vendables au Butin : ceux ramassés et ceux déjà au trésor (brouillon d'avant le butin). */
  const crystalsOwned = (c: Crew) => crystalsGained + (c.campaign?.cristaux ?? 0)
  /**
   * Objets qui rapportent à la bande à chaque partie (« Une bande possédant cet objet gagne +20PO
   * à la fin de chaque partie ») : portés, au sac ou au coffre du camp.
   */
  const recurring = (() => {
    const keys = [
      ...draft.members.filter(isActive).flatMap((m) => (m.loot ?? []).map((l) => l.key)),
      ...(draft.campaign?.stock?.loot ?? []).map((l) => l.key),
    ]
    const out: { name: string; po: number; prestige: number }[] = []
    for (const key of keys) {
      const item = itemByKey(key)
      const m = item?.description.match(/gagne \+?(\d+) ?(PO|en prestige|de prestige)[^.]*à la fin de chaque partie/i)
      if (!item || !m) continue
      const n = Number(m[1])
      out.push({ name: item.name, po: /PO/i.test(m[2]) ? n : 0, prestige: /prestige/i.test(m[2]) ? n : 0 })
    }
    return out
  })()
  const recurringPo = recurring.reduce((t, r) => t + r.po, 0)
  const recurringPrestige = recurring.reduce((t, r) => t + r.prestige, 0)

  // Entretien calculé sur le brouillon (après les morts).
  const stayers = draft.members.filter((m) => isActive(m) && !leaving.includes(m.id))
  const upkeepPo = stayers.reduce((s, m) => s + memberUpkeep(profileOf(faction, m), m, waived.includes(m.id)).po, 0)
  const upkeepCr = stayers.reduce((s, m) => s + memberUpkeep(profileOf(faction, m), m, waived.includes(m.id)).cristaux, 0)
  const treasury = draft.campaign!

  const hasLiqueur = Object.values(liqueurDice).some(Boolean)
  /** XP en plus donnée par les objets portés (« gagne 5xp de plus à la fin de chaque partie »). */
  const gearXp = (mid: string) => {
    const m = draft.members.find((x) => x.id === mid)
    if (!m) return { xp: 0, names: [] as string[] }
    const bonus = lootItems(m)
      .filter(({ ref }) => ref.slot === 'porte')
      .map(({ item }) => ({ name: item?.name ?? '', n: Number(item?.description.match(/gagne (\d+) ?xp de plus à la fin de chaque partie/i)?.[1] ?? 0) }))
      .filter((b) => b.n > 0)
    return { xp: bonus.reduce((t, b) => t + b.n, 0), names: bonus.map((b) => `${b.name} +${b.n}`) }
  }
  const xpTotal = (mid: string) => {
    const v = xp[mid]
    if (!v) return 0
    return (v.participation ?? 0) + 5 * v.places + v.damage + 5 * v.kills + (v.liqueur ?? 0) + gearXp(mid).xp
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
      const sold = Math.min(crystalsSold, crystalsOwned(c))
      if (crystalsGained) lines.push(`${crystalsGained} ${crystalWord(crystalsGained)} ramassé${crystalsGained > 1 ? 's' : ''}`)
      if (sold) lines.push(`${sold} ${crystalWord(sold)} vendu${sold > 1 ? "s" : ""} : +${sold * CRYSTAL_PRICE} PO`)
      if (poFound) lines.push(`${poFound} PO récupérées`)
      if (prestigeGained) lines.push(`${prestigeGained} de prestige`)
      for (const r of recurring) lines.push(`${r.name} : ${[r.po && `+${r.po} PO`, r.prestige && `+${r.prestige} prestige`].filter(Boolean).join(', ')}`)
      if (crown) {
        lines.push(`Couronne sauteuse : +1 prestige${crownCards.length ? `, ${crownCards.map((k) => itemByKey(k)?.name ?? k).join(' et ')} au coffre du camp` : ''}`)
        if (crownCards.length && c.campaign) {
          const stock = c.campaign.stock ?? { equipment: [], loot: [] }
          c = { ...c, campaign: { ...c.campaign, stock: { ...stock, loot: [...stock.loot, ...crownCards.map((key) => ({ id: newId(), key, slot: 'sac' as const }))] } } }
        }
      }
      const delta = { cristaux: crystalsGained - sold, po: poFound + sold * CRYSTAL_PRICE + recurringPo, prestige: prestigeGained + recurringPrestige + (crown ? 1 : 0) }
      if (delta.cristaux || delta.po || delta.prestige) c = withTreasury(c, delta, `${title} : butin`)
    }
    if (k === S.upkeep) {
      c = withTreasury(c, { po: -upkeepPo, cristaux: -upkeepCr }, `${title} : entretien`)
      lines.push(`Entretien payé : ${upkeepPo} PO${upkeepCr ? ` et ${upkeepCr} cristal` : ''}`)
      for (const mid of waived) {
        const m = c.members.find((x) => x.id === mid)
        const p = m && profileOf(faction!, m)
        if (m && p?.upkeep.waiver) lines.push(`${nameOf(faction!, m)} : pas d'entretien (${p.upkeep.waiver})`)
      }
      if (leaving.length) {
        c = withTreasury(c, { prestige: -10 * leaving.length }, `${title} : soldats non payés`)
        lines.push(`Non payés, quittent la bande : ${leaving.map((mid) => nameOf(faction!, memberById(mid))).join(', ')} (-${10 * leaving.length} prestige)`)
      }
      const leavers = c.members.filter((m) => isActive(m) && (leaving.includes(m.id) || m.leavesAfterGame))
      for (const m of leavers.filter((m) => m.leavesAfterGame)) lines.push(`${nameOf(faction!, m)} quitte la bande (blessure)`)
      // Ceux qui partent laissent leur équipement au coffre du camp.
      for (const m of leavers) {
        if (m.equipment.length || m.loot?.length) lines.push(`Équipement de ${nameOf(faction!, m)} rangé au coffre du camp`)
        c = leaveCrew(c, m.id)
      }
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

  /** Revient directement à une étape déjà faite (ses effets et ceux des suivantes sont annulés). */
  function goTo(target: number) {
    if (target >= step || !exits[target]) return
    // Revenir avant le Butin efface ses achats (la bande repart d'avant) : les cartes redeviennent achetables.
    if (target < S.loot) setMarketBought([])
    // Envois d'un ancien brouillon : revenir avant l'entretien les remet dans la bande.
    if (target < S.upkeep) setGifts([])
    setDraft(exits[target])
    setLogs((all) => all.map((l, i) => (i === target ? l.filter((x) => !x.startsWith('§')) : i > target ? [] : l)))
    setStep(target)
    window.scrollTo(0, 0)
  }

  function goBack() {
    if (step - 1 < S.loot) setMarketBought([])
    if (step - 1 < S.upkeep) setGifts([])
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
        recruitUndo: undefined,
        equipment: m.equipment.map((ref) => ({ ...ref, found: undefined, undo: undefined })),
        loot: m.loot?.map((ref) => ({ ...ref, found: undefined, undo: undefined })),
      }))
    // Équipement commun qu'un personnage ne peut pas porter (trouvé en fouillant) : rangé au coffre du camp.
    const stock = { equipment: [...(draft!.campaign!.stock?.equipment ?? [])], loot: [...(draft!.campaign!.stock?.loot ?? [])] }
    const stored: string[] = []
    const kept = members.map((m) => {
      const p = profileOf(faction!, m)
      if (!p || !isActive(m) || draft!.unrestricted) return m
      const out = m.equipment.filter((r) => !p.equipment.includes(r.itemId))
      if (!out.length) return m
      for (const r of out) {
        stock.equipment.push(r.itemId)
        stored.push(`${equipmentById(r.itemId)?.name ?? r.itemId} (${nameOf(faction!, m)})`)
      }
      return { ...m, equipment: m.equipment.filter((r) => p.equipment.includes(r.itemId)) }
    })
    if (stored.length) {
      const line = `Rangé au coffre du camp (ne peut pas le porter) : ${stored.join(', ')}`
      allLines.push(line) // game.lines est ce même tableau
    }
    const final: Crew = {
      ...draft!,
      members: kept,
      campaign: { ...draft!.campaign!, stock, games: [...draft!.campaign!.games, game], currentGame: undefined },
    }
    // La bande ne doit pas avoir changé ailleurs depuis le début du rapport (onglet resté ouvert, autre appareil).
    const current = await getCrew(final.id).catch(() => null)
    if (current && current.updatedAt !== original!.updatedAt) {
      setSaving(false)
      alert("La bande a été modifiée ailleurs pendant le rapport (autre onglet ou autre appareil). Le rapport n'est pas enregistré, pour ne rien écraser : rechargez la page pour le reprendre.")
      return
    }
    // Envois aux autres joueurs d'abord (reçus dès que le destinataire ouvre sa bande) : s'ils sont refusés,
    // le rapport n'est pas enregistré et rien n'est perdu.
    try {
      await sendGifts(final, gifts.map(({ to, toName, po, cristaux, items, message }) => ({ to, toName, po, cristaux, items, ...(message ? { message } : {}) })))
    } catch (err) {
      setSaving(false)
      alert(`Les envois aux autres joueurs ont été refusés (${(err as Error).message}). Le rapport n'est pas enregistré : réessayez.`)
      return
    }
    try {
      // La bande ne doit pas avoir changé ailleurs depuis le début du rapport (sinon on écraserait ces changements).
      await saveCrew(final, original!.updatedAt, { activity: [`Rapport d'après-bataille enregistré : ${title}`] })
    } catch (err) {
      setSaving(false)
      alert(`${(err as Error).message}\n\nLe rapport n'a pas pu être enregistré : la bande a été modifiée ailleurs pendant le rapport. Rechargez la page pour le reprendre.`)
      return
    }
    // Phase de nuit : ce bilan devient le rapport de fin de nuit de la bande.
    await submitSheetIfNeeded(final, allLines).catch(() => false)
    clearLockedPrefix(`${final.id}:g${original!.campaign!.games.length}`)
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
      setMember({ ...m, loot: [...(m.loot ?? []), { id: newId(), key: pick.key, slot: 'sac', found: FOUND_IN_REPORT }] })
      log(`${name} récupère : ${itemByKey(pick.key)?.name ?? pick.key}${pick.paid ? ` (acheté ${pick.price} PO)` : ''}`)
    } else {
      setMember({ ...m, equipment: [...m.equipment, { itemId: pick.itemId, slot: 'sac', found: FOUND_IN_REPORT }] })
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
    flag === FOUND_IN_REPORT || (!!liveGame && (flag === liveGame.id || liveGame.events.some((e) => e.step === 'loot' && e.text === `${nameOf(faction, m)} ramasse : ${name}`)))
  const lootLines = (m: Member) => {
    const all = [
      ...m.equipment.map((ref, i) => ({ key: `e${i}`, id: ref.itemId, kind: 'equipment' as const, ref: i as string | number, name: equipmentById(ref.itemId)?.name ?? ref.itemId, price: equipmentById(ref.itemId)?.price ?? null, loot: false, found: foundInGame(m, ref.found, equipmentById(ref.itemId)?.name ?? ref.itemId) })),
      ...(m.loot ?? []).map((l) => ({ key: l.id, id: l.key, kind: 'loot' as const, ref: l.id as string | number, name: itemByKey(l.key)?.name ?? l.key, price: itemByKey(l.key)?.price ?? null, loot: true, found: foundInGame(m, l.found, itemByKey(l.key)?.name ?? l.key) })),
    ]
    const tag = (it: (typeof all)[number]) => (
      <ItemChip
        key={it.key}
        equipmentId={it.loot ? undefined : it.id}
        lootKey={it.loot ? it.id : undefined}
        after={
          <>
            {it.price ? (
              <button className="tag-remove tag-sell" onClick={() => sellItem(m, it.kind, it.ref, it.name, it.price!)} aria-label={`Vendre ${it.name}`} data-tip={`Vendre pour ${Math.floor(it.price / 2)} PO`}>
                {Math.floor(it.price / 2)} PO
              </button>
            ) : null}
            <button className="tag-remove" onClick={() => loseItem(m, it.kind, it.ref, it.name)} aria-label={`Perdre ${it.name}`} data-tip="Perdre l'objet (dépouillé, détruit…)">×</button>
          </>
        }
      />
    )
    const found = all.filter((it) => it.found)
    const others = all.filter((it) => !it.found)
    if (!all.length) return null
    return (
      <dl className="loot-lines">
        {(liveGame || found.length > 0) && (
          <>
            <dt>Trouvé pendant la partie</dt>
            <dd>{found.length ? <span className="tags">{found.map(tag)}</span> : <span className="muted small">rien</span>}</dd>
          </>
        )}
        {others.length > 0 && (
          <>
            <dt>Déjà sur la figurine</dt>
            <dd><span className="tags">{others.map(tag)}</span></dd>
          </>
        )}
      </dl>
    )
  }

  /** Clé des jets verrouillés de ce rapport (bande + numéro de partie). */
  const rollKey = `${original.id}:g${original.campaign.games.length}`
  const marketDrawn = !!getLocked<boolean>(`${rollKey}:market`)
  const crownDrawn = !!getLocked<boolean>(`${rollKey}:crown`)
  const rollAllXp = () =>
    setXp((all) => {
      const n = { ...all }
      for (const m of alivePlaying) {
        const p = profileOf(faction, m)
        if (p && learnsNothing(p, m)) continue
        const cur = n[m.id] ?? { participation: null, places: 0, damage: 0, kills: 0 }
        const partKey = `${rollKey}:part:${m.id}`
        let participation = cur.participation ?? getLocked<number>(partKey) ?? null
        if (participation === null) {
          participation = d10()
          setLocked(partKey, participation)
        }
        const dice = liqueurDice[m.id] ?? 0
        const liqKey = `${rollKey}:liqueur:${m.id}`
        let liqueur = cur.liqueur ?? getLocked<number>(liqKey)
        if (dice && liqueur === undefined) {
          liqueur = Array.from({ length: dice }, d10).reduce((a, b) => a + b, 0)
          setLocked(liqKey, liqueur)
        }
        n[m.id] = { ...cur, participation, ...(liqueur !== undefined ? { liqueur } : {}) }
      }
      return n
    })
  /** Participants déjà choisis (partie notée en direct) : l'étape « Qui a participé ? » est sautée. */
  const preset = !!original?.campaign?.currentGame
  const levelers = draft.members.filter((m) => isActive(m) && pendingLevels(m) > 0)
  const usedEntries = draft.members.filter(isActive).flatMap((m) => lootItems(m).filter(({ ref }) => ref.used).map((e) => ({ m, ...e })))
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
          : step === S.upkeep && deficit < 0 ? `Il manque ${-deficit} PO pour payer l'entretien : vendez des objets ou des cristaux, ou laissez partir des soldats.`
            : step === S.upkeep && crDeficit < 0 ? `Il manque ${-crDeficit} ${crystalWord(crDeficit)} pour l'entretien.`
              : step === S.xp && learners.some((m) => (xp[m.id]?.participation ?? null) === null) ? `Lancez le dé de participation de : ${learners.filter((m) => (xp[m.id]?.participation ?? null) === null).map((m) => nameOf(faction, m)).join(', ')}.`
                : step === S.xp && learners.some((m) => liqueurDice[m.id] && xp[m.id]?.liqueur === undefined) ? 'Lancez les dés de liqueur.'
                  : step === S.levels && levelers.length > 0 ? `Appliquez les montées de niveau de : ${levelers.map((m) => nameOf(faction, m)).join(', ')}.`
                    : null

  return (
    <section className="after-battle">
      <nav className="crumbs">
        <Link to="/bandes">Mes bandes</Link> <span>›</span> <Link to={crewPath(original)}>{original.name || 'Bande'}</Link> <span>›</span> Après la bataille
      </nav>
      <header className="step-head">
        <div>
          <h1>Après la bataille</h1>
          <p className="step-sub">{original.name} · {treasury.po} PO · {treasury.cristaux} cristaux · {treasury.prestige} prestige</p>
        </div>
        {original.groupCampaign && (
          <button
            className="btn small"
            disabled={checking || saving}
            onClick={() => {
              receivedBefore.current = original.campaign?.receivedGifts?.length ?? 0
              setMailInfo(null)
              setChecking(true)
              setReload((n) => n + 1)
            }}
            data-tip="Ajoute au rapport ce que d'autres joueurs viennent de vous envoyer (PO, cristaux, objets au coffre)."
          >
            {checking ? 'Vérification…' : '📬 Recevoir les envois'}
          </button>
        )}
      </header>
      {mailInfo && <p className="notice ok-notice" role="status">{mailInfo}</p>}

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
          <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''} data-tip={preset && i === S.participants ? 'Choisis pendant la préparation de la journée.' : undefined}>
            {i < step && i >= (preset ? S.items : 0) && exits[i] ? (
              <button type="button" className="stepper-link" onClick={() => goTo(i)} data-tip="Revenir à cette étape">
                <span>{i + 1}</span> {s}
              </button>
            ) : (
              <><span>{i + 1}</span> {s}</>
            )}
          </li>
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
                        <DiceInput value={roll} onChange={(v) => setPoisonRolls((r) => ({ ...r, [ref.id]: v }))} lockKey={`${rollKey}:poison:${ref.id}`} label="Jet de réserve du poison" />
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
            <h3>Cristaux</h3>
            <div className="row wrap">
              <div className="field narrow">
                <span>Cristaux ramassés</span>
                <NumberInput label="Cristaux ramassés" min={0} value={rawCrystals} onChange={setRawCrystals} />
              </div>
            </div>
            <p className="muted small">Chaque cristal ramassé est un cristal magique : il se garde (1 point de prestige en fin de campagne) ou se vend {CRYSTAL_PRICE} PO.</p>
            {crystalsOwned(draft) > 0 && (() => {
              const owned = crystalsOwned(draft)
              const sold = Math.min(crystalsSold, owned)
              const stocked = draft.campaign?.cristaux ?? 0
              return (
                <div className="row wrap crystal-sale">
                  <label className="row">
                    Vendre
                    <NumberInput label="Cristaux à vendre" min={0} max={owned} value={sold} onChange={(n) => setCrystalsSold(Math.floor(n))} />
                    {crystalWord(sold)} sur {owned}, à {CRYSTAL_PRICE} PO pièce
                  </label>
                  {sold > 0 && <strong>+{sold * CRYSTAL_PRICE} PO</strong>}
                  <span className="muted small">
                    {crystalsGained > 0 && stocked > 0 ? `${crystalsGained} ramassé${crystalsGained > 1 ? 's' : ''} + ${stocked} déjà au trésor. ` : stocked > 0 ? `${stocked} déjà au trésor. ` : ''}
                    Vous en garderez {owned - sold}.
                  </span>
                </div>
              )
            })()}

            <h3>Or et prestige</h3>
            <div className="row wrap">
              <div className="field narrow"><span>PO trouvées</span><NumberInput label="PO trouvées" min={0} step={5} value={poFound} onChange={setPoFound} /></div>
              <div className="field narrow"><span>Prestige gagné</span><NumberInput label="Prestige gagné" min={0} value={prestigeGained} onChange={setPrestigeGained} /></div>
            </div>
            {recurring.length > 0 && (
              <p className="notice small">
                Objets de la bande, ajoutés au butin : {recurring.map((r) => `${r.name} (${[r.po && `+${r.po} PO`, r.prestige && `+${r.prestige} prestige`].filter(Boolean).join(', ')})`).join(' · ')}.
              </p>
            )}

            <h3>Objets trouvés</h3>
            <ul className="loot-members">
              {alivePlaying.map((m) => (
                <li key={m.id}>
                  <div className="loot-member-head">
                    <strong>{nameOf(faction, m)}</strong>
                    <button className="btn small" onClick={() => setLootFor(m.id)} data-tip="Noter un objet trouvé pendant la partie (fouille d'un lieu, d'un ennemi…).">⚱ Trouver un objet</button>
                  </div>
                  {lootLines(m) ?? <p className="muted small loot-empty">Aucun objet.</p>}
                </li>
              ))}
            </ul>
            <h3>Couronne sauteuse</h3>
            <label className="switch">
              <input type="checkbox" checked={crown} onChange={(e) => setCrown(e.target.checked)} />
              <span className="switch-track" aria-hidden="true" />
              <span>👑 Ma bande a la couronne sauteuse</span>
            </label>
            {crown && (
              <>
                <p className="muted small">+1 prestige et 2 cartes du paquet Trésor, rangées dans le coffre du camp.</p>
                <div className="row wrap">
                  {crownCards.map((key, i) => (
                    <ItemChip
                      key={i}
                      lootKey={key}
                      after={crownDrawn ? <span className="tag-remove" aria-label="Tirage verrouillé">🔒</span> : <button className="tag-remove" onClick={() => setCrownCards((cs) => cs.filter((_, j) => j !== i))} aria-label="Retirer cette carte">×</button>}
                    />
                  ))}
                  {crownCards.length < 2 && !crownDrawn && (
                    <>
                      <button className="btn small" onClick={() => { setCrownCards((cs) => [...cs, ...drawTreasure(2 - cs.length)]); setLocked(`${rollKey}:crown`, true) }}>🂠 Tirer {2 - crownCards.length} carte{crownCards.length ? '' : 's'} Trésor</button>
                      <select value="" onChange={(e) => e.target.value && setCrownCards((cs) => [...cs, e.target.value].slice(0, 2))} aria-label="Carte Trésor piochée à la table">
                        <option value="">+ Noter une carte piochée…</option>
                        {TREASURE_CHOICES.map((c) => (
                          <optgroup key={c.name} label={c.name}>
                            {c.items.map((it) => <option key={it.key} value={it.key}>{it.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </>
            )}

            <h3>Marché noir</h3>
            {!market ? (
              <>
                <div className="row wrap">
                  <button className="btn" onClick={() => { setMarket(drawMarket(4 + pegre)); setLocked(`${rollKey}:market`, true) }}>🂠 Tirer {4 + pegre} cartes au hasard</button>
                  <button className="btn" onClick={() => setMarket([])} data-tip="Vous piochez les cartes à la table et vous les notez ici.">✎ Noter les cartes piochées à la table</button>
                </div>
                <p className="muted small">4 cartes{pegre ? `, +${pegre} pour Soldat de la Pègre` : ''}. Les cartes non achetées retournent dans le paquet.</p>
              </>
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
                            {!marketDrawn && <button className="icon-btn drop-btn" onClick={() => removeMarketCard(i)} aria-label="Retirer cette carte" data-tip="Retirer cette carte (erreur de saisie)">×</button>}
                            <select value={buyer[i] ?? alivePlaying[0]?.id ?? TO_STOCK} onChange={(e) => setBuyer((b) => ({ ...b, [i]: e.target.value }))} aria-label="Qui reçoit l'objet">
                              <optgroup label="Personnages">
                                {alivePlaying.map((m) => <option key={m.id} value={m.id}>{nameOf(faction, m)}</option>)}
                              </optgroup>
                              <option value={TO_STOCK}>Coffre du camp</option>
                            </select>
                            <button className="btn small primary" disabled={price === null} onClick={() => buyMarket(i)}>Acheter</button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {market.length === 0 && <p className="muted small">Aucune carte notée pour l'instant.</p>}
                {!marketDrawn && <select value="" onChange={(e) => e.target.value && setMarket((m) => [...(m ?? []), e.target.value])} aria-label="Ajouter une carte Marché noir">
                  <option value="">+ Ajouter une carte piochée…</option>
                  {MARKET_CHOICES.map((c) => (
                    <optgroup key={c.name} label={c.name}>
                      {c.items.map((it) => <option key={it.key} value={it.key}>{it.name}{it.price !== null ? ` — ${it.price} PO` : ''}</option>)}
                    </optgroup>
                  ))}
                </select>}
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
            <p className="muted small">Cochés : entretien payé, le soldat reste. Le chef ne coûte rien, sauf exception indiquée sur son profil.</p>
            <ul className="check-list">
              {draft.members.filter(isActive).map((m) => {
                const p = profileOf(faction, m)
                const u = memberUpkeep(p, m, waived.includes(m.id))
                const base = memberUpkeep(p, m)
                const on = leaving.includes(m.id)
                // Un chef qui a son propre entretien (Vampire) part s'il n'est ni payé ni dispensé (il a mordu).
                const chefLocked = isChef(p, m) && !on && !((u.cristaux > 0 && u.cristaux > treasury.cristaux) || (u.po > 0 && u.po > treasury.po))
                const canWaive = !!p?.upkeep.waiver && participants.includes(m.id) && (base.po > 0 || base.cristaux > 0)
                return (
                  <li key={m.id}>
                    <label>
                      <input type="checkbox" checked={!on} disabled={chefLocked} onChange={() => setLeaving((l) => (on ? l.filter((x) => x !== m.id) : [...l, m.id]))} aria-label={`Entretien payé : ${nameOf(faction, m)}`} />
                      <strong>{nameOf(faction, m)}</strong>{' '}
                      <span className="muted small">{u.cristaux ? `${u.cristaux} cristal` : `${u.po} PO`}{on ? ' · non payé, quitte la bande' : ' · payé'}</span>
                      {m.leavesAfterGame && <span className="badge ko">Part après la partie</span>}
                    </label>
                    {canWaive && (
                      <label className="waiver">
                        <input
                          type="checkbox"
                          checked={waived.includes(m.id)}
                          onChange={(e) => setWaived((w) => (e.target.checked ? [...w, m.id] : w.filter((x) => x !== m.id)))}
                        />
                        🩸 A mordu (non démon, non mort-vivant) : pas d'entretien
                      </label>
                    )}
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
              · ennemi tué : 5 XP. Un dé lancé par le site est verrouillé 🔒.
            </p>
            <button className="btn small" onClick={rollAllXp}>
              🎲 Lancer toutes les participations{hasLiqueur ? ' et les liqueurs' : ''}
            </button>
            <div className="xp-cards">
              {alivePlaying.map((m) => {
                const p = profileOf(faction, m)
                const v = xp[m.id] ?? { participation: null, places: 0, damage: 0, kills: 0 }
                const set = (patch: Partial<XpInput>) => setXp((all) => ({ ...all, [m.id]: { ...(all[m.id] ?? v), ...patch } }))
                if (p && learnsNothing(p, m)) {
                  return (
                    <article key={m.id} className="xp-card muted-card">
                      <header><strong>{nameOf(faction, m)}</strong><span className="muted small">N'apprend rien</span></header>
                    </article>
                  )
                }
                const liqueurKey = `${rollKey}:liqueur:${m.id}`
                const liqueurLocked = getLocked<number>(liqueurKey)
                return (
                  <article key={m.id} className="xp-card">
                    <header>
                      <strong>{nameOf(faction, m)}</strong>
                      <span className="xp-card-total" data-tip={`${m.xp} XP avant la partie`}>+{xpTotal(m.id)} XP</span>
                    </header>
                    <dl>
                      <dt>Participation <small>1D10</small></dt>
                      <dd><DiceInput value={v.participation} onChange={(r) => set({ participation: r })} lockKey={`${rollKey}:part:${m.id}`} label="Jet de participation" /></dd>
                      <dt>Lieux fouillés <small>5 XP chacun</small></dt>
                      <dd><Counter label="Lieux fouillés" hideLabel value={v.places} onDelta={(d) => set({ places: Math.max(0, v.places + d) })} /></dd>
                      <dt>PV retirés <small>XP de la figurine touchée</small></dt>
                      <dd><Counter label="XP de PV retirés" hideLabel editable steps={[1, 5]} value={v.damage} onDelta={(d) => set({ damage: Math.max(0, v.damage + d) })} /></dd>
                      <dt>Ennemis tués <small>5 XP chacun</small></dt>
                      <dd><Counter label="Ennemis tués" hideLabel value={v.kills} onDelta={(d) => set({ kills: Math.max(0, v.kills + d) })} /></dd>
                      {liqueurDice[m.id] ? (
                        <>
                          <dt>Liqueur <small>{liqueurDice[m.id]}D10</small></dt>
                          <dd>
                            {liqueurLocked !== undefined ? (
                              <span className="dice-input dice-locked" data-tip="Jet lancé par le site : il ne peut plus être relancé."><strong>{liqueurLocked}</strong> 🔒</span>
                            ) : (
                              <span className="dice-input">
                                <NumberInput label="XP de liqueur" min={0} value={v.liqueur ?? null} placeholder={`${liqueurDice[m.id]}D10`} onChange={(n) => set({ liqueur: n })} />
                                <button type="button" className="btn small" onClick={() => {
                                  const r = Array.from({ length: liqueurDice[m.id] }, d10).reduce((a, b) => a + b, 0)
                                  setLocked(liqueurKey, r)
                                  set({ liqueur: r })
                                }} title="Lancer les dés (une seule fois)">🎲</button>
                              </span>
                            )}
                          </dd>
                        </>
                      ) : null}
                    </dl>
                    {gearXp(m.id).xp > 0 && <p className="muted small" data-tip="XP donnée par un objet porté">dont {gearXp(m.id).names.join(', ')}</p>}
                  </article>
                )
              })}
            </div>
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
                    lockPrefix={rollKey}
                    key={`${m.id}-${m.level}`}
                    factionId={faction.id}
                    profile={p}
                    member={m}
                    onApply={(input) => {
                      const updated = applyAdvance(m, input)
                      setMember(updated)
                      const adv = updated.advances!.slice(-1)[0]
                      const spell = adv.spellId ? spellById(adv.spellId)?.name ?? adv.spellId : ''
                      log(`${nameOf(faction, m)} passe niveau ${updated.level} : ${adv.label}${spell ? ` · nouveau sort : ${spell}` : ''}`)
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
            <p className="muted small">Ensuite, achetez et vendez de l'équipement ou recrutez depuis le builder.{original.groupCampaign ? ' Le commerce avec les autres joueurs se fait depuis la page de la campagne (⇄ Commerce).' : ''}</p>
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
            lockKey={`${rollKey}:inj:${injuryFor}`}
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
            foundOnly
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
