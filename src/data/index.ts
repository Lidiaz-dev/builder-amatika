import factionsJson from './factions.json'
import equipmentJson from './equipment.json'
import skillsJson from './skills.json'
import rulesJson from './rules.json'
import spellsJson from './spells.json'
import itemsJson from './items.json'
import loreJson from './lore.json'
import injuriesJson from './injuries.json'
import locationsJson from './locations.json'
import creaturesJson from './creatures.json'

export type StatKey = 'mou' | 'com' | 'tir' | 'for' | 'end' | 'agi' | 'att' | 'pv' | 'cmd' | 'svg'
export type Stats = Record<StatKey, number | null>
export type Role = 'chef' | 'recrue' | 'specialiste' | 'monstre'

export interface Profile {
  id: string
  name: string
  cost: number
  min: number
  max: number
  role: Role
  stats: Stats
  skills: string[]
  /** Chaque entrée est un choix « A OU B » à faire au recrutement. */
  skillChoices: string[][]
  equipment: string[]
  trees: string[]
  upkeep: { po: number; perLevel: boolean; cristaux: number }
  /** Expérience gagnée par point de vie retiré à cette figurine. */
  xpValue: number | null
  notes: string[]
  /** Nombre de sorts connus au recrutement (2 par défaut pour un mage). */
  startingSpells?: number
  /** Nombre de mains disponibles pour armes et bouclier (2 par défaut). */
  hands?: number
}

export interface Faction {
  id: string
  name: string
  /** Règles propres à toute la faction. */
  notes: string[]
  profiles: Profile[]
}

export type EquipmentCategory = 'melee' | 'ranged' | 'armor' | 'shield' | 'helmet'

export interface Equipment {
  id: string
  name: string
  category: EquipmentCategory
  hands: number
  price: number
  strength?: string
  range?: number
  rules: string
  save?: number
  move?: number
  exclusiveMelee?: boolean
  shieldVsShots?: boolean
  /** Encombrée : -1 pour toucher au corps à corps, cumulable. */
  encumbered?: boolean
}

export interface Skill {
  id: string
  name: string
  tree: string
  description: string
}

export interface Spell {
  id: string
  name: string
  type: string
  /** Valeur de lancement à obtenir sur 2D10. */
  value: number | null
  range: number | null
  target: string
  description: string
  racial: string | null
  factions: string[]
  /** Connu de tous les mages (Orbe mineur). */
  universal: boolean
  /** Sorts « Nécromant bonus » : réservés à la faction mais pas donnés au recrutement. */
  bonus: boolean
  /** Restreint à certains profils (ex. Chaman Capuchard). */
  profiles?: string[]
  summon?: Stats
  summonSkills?: string
}

export type Rarity = 'blanc' | 'gris' | 'vert' | 'jaune'

export const RARITIES: Rarity[] = ['blanc', 'gris', 'vert', 'jaune']

export const RARITY_LABELS: Record<Rarity, string> = {
  blanc: 'Commun (blanc)',
  gris: 'Spécial (gris)',
  vert: 'Rare (vert)',
  jaune: 'Épique (jaune)',
}

export interface TreasureItem {
  id: string
  name: string
  description: string
  price: number | null
  rarity: Rarity
  /** Effet sur la fiche quand l'objet est porté (valeurs brutes, voir StatMods). */
  mods?: Partial<Record<StatKey, number>>
  /** Compétences données au porteur. */
  skills?: string[]
  /** Objet à usage unique : potion (défaussée après la partie), poison (jet de réserve) ou autre. */
  consumable?: 'potion' | 'poison' | 'single'
  /** Effet sur la fiche une fois utilisé, jusqu'à la fin de la partie. */
  useMods?: Partial<Record<StatKey, number>>
  useSkills?: string[]
  /** Liqueurs : nombre de D10 d'XP gagnés à la fin de la bataille. */
  xpDice?: number
}

export interface ItemCategory {
  id: string
  name: string
  items: TreasureItem[]
}

/** Carte du paquet Blessure. */
export interface Injury {
  id: string
  /** Identifiant commun aux cartes de même nom (ex. les différents « Assommé »). */
  kind: string
  name: string
  value: number
  description: string
  quantity: number
  /** La carte laisse une trace après la bataille. */
  lasting: boolean
  mods?: Partial<Record<StatKey, number>>
  gainSkill?: string
  missNextGame?: boolean
  dead?: boolean
  /** Amputation ou œil crevé : la deuxième fois, la figurine quitte la bande. */
  mark?: 'jambe' | 'bras' | 'oeil'
  leavesOnSecond?: boolean
  handsLost?: number
  special?: 'negotiate' | 'multiple' | 'bag'
}

export interface RuleSection {
  id: string
  title: string
  level: number
  paragraphs: string[]
}

/** Toutes les listes s'affichent par ordre alphabétique (les profils d'une faction gardent leur ordre). */
export const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'fr')
export const factions = [...(factionsJson as Faction[])].sort(byName)
export const equipment = [...(equipmentJson as Equipment[])].sort(byName)
export const skills = [...(skillsJson as Skill[])].sort(byName)
export const rules = rulesJson as RuleSection[]
/** Ordre du fichier Cartes : sert à trouver le sort racial de départ. */
const spellsInFileOrder = spellsJson as Spell[]
export const spells = [...spellsInFileOrder].sort(byName)
export const itemCategories = (itemsJson as ItemCategory[])
  .map((c) => ({ ...c, items: [...c.items].sort(byName) }))
  .sort(byName)
export const lore = loreJson as { title: string; paragraphs: string[] }
export const injuries = injuriesJson as Injury[]

/** Paquet d'un type de lieu d'intérêt (42 cartes). */
export interface LocationDeck {
  id: string
  name: string
  /** Couleur du dos des cartes. */
  color: string
  cards: { id: string; text: string }[]
}

/** Créature de la faune d'Amatika. */
export interface Creature {
  id: string
  name: string
  stats: Stats
  skills: string[]
  /** Ce que l'on gagne en la fouillant. */
  gifts: string
}

export const locationDecks = locationsJson as LocationDeck[]
export const creatures = creaturesJson as Creature[]
export const injuryById = (id: string) => injuries.find((i) => i.id === id)
/** Clé unique d'un objet de trésor : « catégorie/objet » (certains noms existent dans deux catégories). */
export const itemKey = (categoryId: string, itemId: string) => `${categoryId}/${itemId}`

export function itemByKey(key: string) {
  const [catId, id] = key.split('/')
  const cat = itemCategories.find((c) => c.id === catId)
  const it = cat?.items.find((i) => i.id === id)
  return it && cat ? { ...it, key, category: cat.name } : undefined
}

export const STAT_COLUMNS: { key: StatKey; label: string; dice: boolean }[] = [
  { key: 'mou', label: 'Mou', dice: false },
  { key: 'com', label: 'Com', dice: true },
  { key: 'tir', label: 'Tir', dice: true },
  { key: 'for', label: 'For', dice: false },
  { key: 'end', label: 'End', dice: false },
  { key: 'agi', label: 'Agi', dice: true },
  { key: 'att', label: 'Att', dice: false },
  { key: 'pv', label: 'PV', dice: false },
  { key: 'cmd', label: 'Comm', dice: true },
  { key: 'svg', label: 'Svg', dice: true },
]

export const TREE_LABELS: Record<string, string> = {
  general: 'Général',
  combat: 'Combat',
  tir: 'Tir',
  erudition: 'Érudition',
  force: 'Force',
  agilite: 'Agilité',
  reconnaissance: 'Reconnaissance',
  divers: 'Divers',
}

export const ROLE_LABELS: Record<Role, string> = {
  chef: 'Chef',
  recrue: 'Recrue',
  specialiste: 'Spécialiste',
  monstre: 'Monstre',
}

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  melee: 'Armes de corps à corps',
  ranged: 'Armes de tir',
  armor: 'Armures',
  shield: 'Boucliers',
  helmet: 'Casques',
}

export const factionById = (id: string) => factions.find((f) => f.id === id)
export const spellById = (id: string) => spells.find((s) => s.id === id)

/** Sorts qu'un mage de ce profil peut connaître : sorts communs + sorts raciaux de sa faction. */
export function spellsFor(factionId: string, profileId: string) {
  return spells.filter((s) => {
    if (s.profiles && !s.profiles.includes(profileId)) return false
    return s.universal || s.factions.length === 0 || s.factions.includes(factionId)
  })
}

/** Nombre de sorts de départ d'un mage (Orbe mineur + sort racial) : ils ne peuvent pas être retirés. */
export const baseSpellCount = (profile: Profile) => profile.startingSpells ?? 2

/**
 * Sort racial de départ : celui réservé au profil s'il existe (le Squig du Chaman Capuchard),
 * sinon le sort racial de la faction.
 */
function racialStartingSpell(factionId: string, profile: Profile) {
  const racial = spellsInFileOrder.filter((s) => s.factions.includes(factionId) && !s.bonus)
  return racial.find((s) => s.profiles?.includes(profile.id)) ?? racial.find((s) => !s.profiles)
}

/** Sorts connus au recrutement : Orbe mineur + le sort racial de la faction. */
export function startingSpellIds(factionId: string, profile: Profile) {
  const universal = spellsInFileOrder.filter((s) => s.universal).map((s) => s.id)
  if (baseSpellCount(profile) <= 1) return universal
  const racial = racialStartingSpell(factionId, profile)
  return racial ? [...universal, racial.id] : universal
}

/** Faction sans sort racial (Cités-États) : le 2e sort de départ se choisit parmi 5 tirés au hasard. */
export const choosesSecondSpell = (factionId: string, profile: Profile) =>
  baseSpellCount(profile) >= 2 && !racialStartingSpell(factionId, profile)

export const equipmentById = (id: string) => equipment.find((e) => e.id === id)

export function skillByName(name: string): Skill | undefined {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/^[eé]claireur \d+$/i.test(name)) return skills.find((s) => s.id === 'eclaireur-x')
  return skills.find((s) => norm(s.name) === norm(name))
}

/**
 * Objets raciaux : chaque faction peut acheter le sien dès la création de la bande.
 * `key` : clé « catégorie/objet » de items.json. `requires` : équipement de base que le profil
 * doit pouvoir porter (une arbalète naine reste une arbalète). Sans `requires`, tout le monde y a accès.
 * Renégats (variable) et Démons (aucun) n'en ont pas ; Chaos est prêt pour le jour où la faction existera.
 */
export interface RacialItem {
  key: string
  requires?: string
}

export const RACIAL_ITEMS: Record<string, RacialItem[]> = {
  'haut-elfe': [{ key: 'armures-legeres/armure-semi-legere', requires: 'armure-legere' }],
  'cites-etats': [{ key: 'armures-lourdes/armure-lourde-humaine', requires: 'armure-lourde' }],
  skaven: [{ key: 'gants/gants-du-voleur' }],
  nains: [{ key: 'arbaletes/arbalete-naine', requires: 'arbalete' }],
  mangechair: [{ key: 'chaussures/chausses-de-mangechairs' }],
  orques: [{ key: 'haches/hache-touche-toujours', requires: 'hache' }],
  tieffelin: [{ key: 'arcs/arc-tieffelin', requires: 'arc' }],
  gobelins: [{ key: 'lances/lance-habile', requires: 'lance' }],
  drow: [{ key: 'poisons/fysthoren' }],
  'la-harde': [{ key: 'arcs-courts/arc-court-en-bois-dignane', requires: 'arc-court' }],
  drakeide: [{ key: 'sarbacanes/sarbacane-skink', requires: 'sarbacane' }],
  'elfe-des-bois': [{ key: 'arcs-longs/arc-elfique', requires: 'arc-long' }],
  halfling: [{ key: 'talismans/porte-bonheur' }],
  ogre: [{ key: 'fioles/potion-de-force' }],
  necromant: [{ key: 'batons/baton-energetique', requires: 'baton' }],
  'nain-d-ashut': [{ key: 'haches-lourdes/hache-lourde-des-forges-naines', requires: 'hache-lourde' }],
  bretonniens: [{ key: 'casques/casque-de-chevalier', requires: 'casque' }],
  chaos: [{ key: 'fioles/cocktail-molotov' }],
  cathay: [{ key: 'epees/katana', requires: 'epee' }],
  khajiit: [{ key: 'boucliers/bouclier-khajiit', requires: 'bouclier' }],
  ondin: [{ key: 'javelots/javelot-paamidien', requires: 'javelot' }],
}

/** Objets raciaux d'une faction, prêts à afficher. */
export const racialItemsOf = (factionId: string) =>
  (RACIAL_ITEMS[factionId] ?? []).flatMap((r) => {
    const it = itemByKey(r.key)
    return it ? [{ ...it, requires: r.requires }] : []
  })

/** Équipement de base exigé pour porter cet objet racial (undefined si aucun). */
export const racialRequirement = (key: string) =>
  Object.values(RACIAL_ITEMS).flat().find((r) => r.key === key)?.requires

/** Factions (noms) pour lesquelles cet objet est racial. */
export function racialFactionsOf(key: string) {
  return Object.entries(RACIAL_ITEMS)
    .filter(([, list]) => list.some((r) => r.key === key))
    .map(([id]) => factions.find((f) => f.id === id)?.name ?? (id === 'chaos' ? 'Chaos' : id))
}
