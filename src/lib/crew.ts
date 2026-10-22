import { randomName } from './names'
import {
  equipmentById,
  factionById,
  itemByKey,
  startingSpellIds,
  type Equipment,
  type Faction,
  type Profile,
  type StatKey,
  type Stats,
} from '../data'

export type Slot = 'porte' | 'sac'

export interface ItemRef {
  itemId: string
  slot: Slot
}

/** Objet de trésor ou du marché noir porté par une figurine. */
export interface LootRef {
  id: string
  /** Clé « catégorie/objet » (voir itemKey). */
  key: string
  slot: Slot
  /** Consommable utilisé pendant la partie en cours (défaussé ou testé après la bataille). */
  used?: boolean
  /** Objet racial acheté à la création : son prix compte dans le coût de la bande. */
  racial?: boolean
}

export type StatMods = Partial<Record<StatKey, number>>

/** Blessure durable reçue, conservée pour pouvoir l'annuler. */
export interface InjuryRecord {
  id: string
  cardId: string
  date: string
}

/** Résultat d'une montée de niveau. */
export interface Advance {
  id: string
  level: number
  roll: number
  label: string
  mods?: StatMods
  skill?: string
  spellId?: string
}

export type MemberStatus = 'actif' | 'mort' | 'parti'

export interface Member {
  id: string
  name: string
  /** Nom proposé à l'ajout (affiché en gris) : il devient le nom si on ne le change pas. */
  suggestedName?: string
  profileId: string
  equipment: ItemRef[]
  /** Compétences choisies pour chaque « A OU B » du profil, dans l'ordre. */
  skillChoices: string[]
  /** Sorts connus (mages). Les premiers (voir baseSpellCount) sont les sorts de départ. */
  spellIds?: string[]
  /** Les 5 sorts tirés au hasard pour choisir le 2e sort de départ (Cités-États). */
  spellDraft?: string[]
  /** Ancien champ libre des sorts, conservé pour les bandes existantes. */
  spells: string
  notes: string
  xp: number
  /** Niveau atteint (montées de niveau appliquées). */
  level: number
  // Campagne
  status?: MemberStatus
  statMods?: StatMods
  gainedSkills?: string[]
  injuries?: InjuryRecord[]
  advances?: Advance[]
  loot?: LootRef[]
  /** Blessure grave : ne joue pas la prochaine partie. */
  missNextGame?: boolean
  /** Deuxième amputation ou deuxième œil crevé : quittera la bande après la partie. */
  leavesAfterGame?: boolean
  /** Devenu chef après la mort du précédent. */
  promotedChef?: boolean
}

export interface GameRecord {
  id: string
  date: string
  title: string
  participants: string[]
  lines: string[]
}

export interface LogEntry {
  date: string
  label: string
  po?: number
  cristaux?: number
  prestige?: number
}

/** Compteurs d'une figurine pendant la partie (pour l'XP de fin de partie). */
export interface LiveTally {
  /** XP des points de vie retirés aux ennemis (2 à 10 par PV selon la figurine). */
  damageXp: number
  kills: number
  places: number
}

/** Partie en cours, enregistrée dans la bande pour ne rien perdre si on ferme la page. */
export interface LiveGame {
  id: string
  title: string
  startedAt: string
  participants: string[]
  /** Figurines mises hors de combat pendant la partie. */
  outOfAction: string[]
  rawCrystals: number
  poFound: number
  prestige: number
  tallies: Record<string, LiveTally>
  /** Ce qui s'est passé (blessures, objets ramassés), repris dans l'assistant d'après-partie. */
  events: { step: 'injuries' | 'loot'; text: string }[]
}

export interface Campaign {
  startedAt: string
  po: number
  cristaux: number
  prestige: number
  games: GameRecord[]
  log: LogEntry[]
  currentGame?: LiveGame
}

export type Phase = 'preparation' | 'gestion' | 'partie'

export function phaseOf(crew: Crew): Phase {
  if (!crew.campaign) return 'preparation'
  return crew.campaign.currentGame ? 'partie' : 'gestion'
}

export const PHASE_LABELS: Record<Phase, string> = {
  preparation: 'En préparation',
  gestion: 'Entre deux parties',
  partie: 'Partie en cours',
}

export const emptyTally = (): LiveTally => ({ damageXp: 0, kills: 0, places: 0 })

export interface Crew {
  id: string
  name: string
  factionId: string
  budget: number
  /** Désactive les contrôles du builder (effectifs, budget, mains, équipement autorisé…). */
  unrestricted?: boolean
  members: Member[]
  /** Présent une fois la campagne démarrée : trésor, historique des parties. */
  campaign?: Campaign
  /** Campagne de groupe (organisée par l'organisateur) à laquelle la bande est inscrite. */
  groupCampaign?: { id: string; name: string }
  /** Préparation de la journée de campagne : membres qui y participeront. */
  dayPrep?: { campaignId: string; day: number; members: string[] }
  createdAt: string
  updatedAt: string
}

export const DEFAULT_BUDGET = 500
export const MAX_ON_TABLE = 10
/** Prix de vente d'un cristal magique. */
export const CRYSTAL_PRICE = 25

export const newId = () => crypto.randomUUID()

export const isMage = (profile: Profile) => profile.skills.includes('Mage')

/** Nom affiché : celui saisi, sinon celui proposé à l'ajout. */
export const memberName = (m: Member) => m.name.trim() || m.suggestedName || ''

export function newMember(factionId: string, profile: Profile, taken: string[] = []): Member {
  // Le nom proposé est directement le nom du membre (modifiable) ; on le garde à part pour le 🎲.
  const name = randomName(factionId, taken)
  return {
    id: newId(),
    name,
    suggestedName: name,
    profileId: profile.id,
    equipment: [],
    skillChoices: profile.skillChoices.map(() => ''),
    spellIds: isMage(profile) ? startingSpellIds(factionId, profile) : [],
    spells: '',
    notes: '',
    xp: 0,
    level: 1,
  }
}

export function profileOf(faction: Faction | undefined, member: Member) {
  return faction?.profiles.find((p) => p.id === member.profileId)
}

export const isActive = (m: Member) => (m.status ?? 'actif') === 'actif'
export const activeMembers = (crew: Crew) => crew.members.filter(isActive)
export const isChef = (profile: Profile | undefined, m: Member) => profile?.role === 'chef' || !!m.promotedChef

function items(member: Member, slot?: Slot): Equipment[] {
  return member.equipment
    .filter((r) => !slot || r.slot === slot)
    .map((r) => equipmentById(r.itemId))
    .filter((e): e is Equipment => !!e)
}

export function lootItems(member: Member) {
  return (member.loot ?? []).map((ref) => ({ ref, item: itemByKey(ref.key) }))
}

export function memberCost(faction: Faction | undefined, member: Member) {
  const profile = profileOf(faction, member)
  const racial = lootItems(member).reduce((sum, l) => sum + (l.ref.racial ? (l.item?.price ?? 0) : 0), 0)
  return (profile?.cost ?? 0) + items(member).reduce((sum, e) => sum + e.price, 0) + racial
}

export function crewCost(crew: Crew) {
  const faction = factionById(crew.factionId)
  return crew.members.reduce((sum, m) => sum + memberCost(faction, m), 0)
}

export function memberUpkeep(profile: Profile | undefined, member: Member) {
  if (!profile || isChef(profile, member)) return { po: 0, cristaux: 0 }
  const po = profile.upkeep.perLevel ? profile.upkeep.po * member.level : profile.upkeep.po
  return { po, cristaux: profile.upkeep.cristaux }
}

/** Entretien des membres actifs (les morts et les partis ne réclament plus rien). */
export function crewUpkeep(crew: Crew) {
  const faction = factionById(crew.factionId)
  return activeMembers(crew).reduce(
    (acc, m) => {
      const u = memberUpkeep(profileOf(faction, m), m)
      return { po: acc.po + u.po, cristaux: acc.cristaux + u.cristaux }
    },
    { po: 0, cristaux: 0 },
  )
}

/**
 * Caractéristiques finales : profil + blessures et montées de niveau,
 * sauvegarde et mouvement selon l'armure portée, +1 attaque avec 2 armes.
 */
export function effectiveStats(profile: Profile, member: Member): Stats {
  const worn = items(member, 'porte')
  const stats = { ...profile.stats }
  const apply = (mods: StatMods | undefined) => {
    for (const [k, v] of Object.entries(mods ?? {}) as [StatKey, number][]) {
      if (stats[k] !== null) stats[k] = stats[k]! + v
    }
  }
  apply(member.statMods)
  // Objets de trésor portés.
  for (const { ref, item } of lootItems(member)) {
    if (ref.slot === 'porte') apply(item?.mods)
    // Potion bue : effet jusqu'à la fin de la partie.
    if (ref.used) apply(item?.useMods)
  }
  // Encombrée : -1 pour toucher au corps à corps par objet encombrant porté.
  const encumbered = worn.filter((e) => e.encumbered).length
  if (stats.com !== null && encumbered) stats.com += encumbered
  const saveBonus = worn.reduce((sum, e) => sum + (e.save ?? 0), 0)
  if (stats.svg !== null) stats.svg = stats.svg - saveBonus
  const moveMalus = Math.max(0, ...worn.map((e) => e.move ?? 0))
  if (stats.mou !== null) stats.mou = Math.max(0, stats.mou - moveMalus)
  if (stats.att !== null && worn.filter((e) => e.category === 'melee').length >= 2) stats.att += 1
  return stats
}

export function memberSkills(profile: Profile, member: Member) {
  const fromItems = lootItems(member).flatMap(({ ref, item }) => [
    ...(ref.slot === 'porte' ? item?.skills ?? [] : []),
    ...(ref.used ? item?.useSkills ?? [] : []),
  ])
  return [...new Set([...profile.skills, ...member.skillChoices.filter(Boolean), ...(member.gainedSkills ?? []), ...fromItems])]
}

/** Mains disponibles pour armes et bouclier, après un éventuel bras amputé. */
export function handsAvailable(profile: Profile, member: Member) {
  const lost = (member.injuries ?? []).filter((r) => r.cardId.startsWith('bras-empute')).length
  return Math.max(0, (profile.hands ?? 2) - lost)
}

/** 3 actions par activation, +1 aux niveaux 4, 7 et 10 (4, 5 puis 6 actions). */
export const actionsOf = (member: Member) => 3 + [4, 7, 10].filter((l) => member.level >= l).length

export function wornItems(member: Member) {
  return items(member, 'porte')
}

export function bagItems(member: Member) {
  return items(member, 'sac')
}

/** Ajoute une ligne au journal du trésor et met les compteurs à jour. */
export function withTreasury(crew: Crew, delta: { po?: number; cristaux?: number; prestige?: number }, label: string): Crew {
  if (!crew.campaign) return crew
  const c = crew.campaign
  return {
    ...crew,
    campaign: {
      ...c,
      po: c.po + (delta.po ?? 0),
      cristaux: c.cristaux + (delta.cristaux ?? 0),
      prestige: c.prestige + (delta.prestige ?? 0),
      log: [...c.log, { date: new Date().toISOString(), label, ...delta }],
    },
  }
}

/** Rappel des objets portés ou au sac par les membres actifs : nom et règle, sans doublon. */
export function crewItemsReminder(crew: Crew): { name: string; text: string }[] {
  const seen = new Map<string, string>()
  for (const m of crew.members.filter(isActive)) {
    for (const e of items(m)) {
      if (seen.has(e.name)) continue
      const facts = [
        e.strength && (e.category === 'melee' || e.category === 'ranged') ? `Force ${e.strength.toLowerCase()}` : '',
        e.range !== undefined ? `portée ${e.range}ps` : '',
        e.hands ? `${e.hands === 1 ? 'une main' : 'deux mains'}` : '',
      ].filter(Boolean)
      seen.set(e.name, [facts.join(' ; '), e.rules].filter(Boolean).join('. ') || 'Pas de règle spéciale.')
    }
    for (const { item } of lootItems(m)) {
      if (item && !seen.has(item.name)) seen.set(item.name, item.description || 'Pas de description.')
    }
  }
  return [...seen].map(([name, text]) => ({ name, text })).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Abandonne la partie en cours : compteurs et objets utilisés remis à zéro.
 * Les blessures et objets ramassés restent sur les figurines.
 */
export function abandonGame(c: Crew): Crew {
  if (!c.campaign?.currentGame) return c
  return {
    ...c,
    dayPrep: undefined,
    members: c.members.map((m) => (m.loot?.some((l) => l.used) ? { ...m, loot: m.loot.map((l) => ({ ...l, used: false })) } : m)),
    campaign: { ...c.campaign, currentGame: undefined },
  }
}
