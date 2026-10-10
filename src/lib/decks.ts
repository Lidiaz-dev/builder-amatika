import {
  creatures,
  injuries,
  itemCategories,
  itemKey,
  locationDecks,
  spells,
  type Rarity,
} from '../data'

/** Une carte physique du paquet (les exemplaires multiples ont chacun leur identifiant). */
export interface DeckCard {
  uid: string
  title: string
  /** Référence vers la donnée détaillée (objet, blessure, créature, sort…). */
  ref: string
  text?: string
  rarity?: Rarity
}

export interface Deck {
  id: string
  name: string
  /** Couleur du dos des cartes. */
  color: string
  /** Couleur du texte sur le dos. */
  ink: string
  group: 'lieux' | 'partie' | 'apres'
  kind: 'location' | 'injury' | 'item' | 'creature' | 'spell'
  cards: DeckCard[]
}

const copies = (n: number, base: Omit<DeckCard, 'uid'>, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({ ...base, uid: `${prefix}#${i + 1}` }))

/** Nombre d'exemplaires par rareté : paquet Trésor et paquet Marché noir (liste des objets). */
const TREASURE_COPIES: Record<Rarity, number> = { blanc: 5, gris: 5, vert: 2, jaune: 1 }
const BLACK_MARKET_COPIES: Record<Rarity, number> = { blanc: 5, gris: 3, vert: 1, jaune: 0 }

function itemDeck(id: string, perRarity: Record<Rarity, number>): DeckCard[] {
  return itemCategories.flatMap((c) =>
    c.items.flatMap((it) => {
      const key = itemKey(c.id, it.id)
      return copies(perRarity[it.rarity], { title: it.name, ref: key, rarity: it.rarity }, `${id}:${key}`)
    }),
  )
}

export const DECKS: Deck[] = [
  ...locationDecks.map((d) => ({
    id: d.id,
    name: d.name,
    color: d.color,
    ink: ['ville', 'naturel', 'coffre'].includes(d.id) ? '#2b1d10' : '#fbf1dc',
    group: 'lieux' as const,
    kind: 'location' as const,
    cards: d.cards.map((c) => ({ uid: c.id, title: d.name, ref: c.id, text: c.text })),
  })),
  {
    id: 'objets', name: 'Objets (trésor)', color: '#8d8a84', ink: '#fbf1dc', group: 'partie', kind: 'item',
    cards: itemDeck('objets', TREASURE_COPIES),
  },
  {
    id: 'blessures', name: 'Blessures', color: '#9b1b10', ink: '#fbf1dc', group: 'partie', kind: 'injury',
    cards: injuries.flatMap((inj) => copies(inj.quantity, { title: inj.name, ref: inj.id, text: inj.description }, `blessures:${inj.id}`)),
  },
  {
    id: 'creatures', name: 'Créatures', color: '#c9a227', ink: '#2b1d10', group: 'partie', kind: 'creature',
    cards: creatures.map((c) => ({ uid: `creatures:${c.id}`, title: c.name, ref: c.id })),
  },
  {
    id: 'marche-noir', name: 'Marché noir', color: '#231a14', ink: '#f1dfb4', group: 'apres', kind: 'item',
    cards: itemDeck('marche-noir', BLACK_MARKET_COPIES),
  },
  {
    id: 'sorts', name: 'Sorts', color: '#6d1a2a', ink: '#fbf1dc', group: 'apres', kind: 'spell',
    // Les sorts raciaux et l'Orbe mineur ne sont pas dans la pioche.
    cards: spells.filter((sp) => !sp.universal && !sp.racial).map((sp) => ({ uid: `sorts:${sp.id}`, title: sp.name, ref: sp.id })),
  },
]

export const deckById = (id: string) => DECKS.find((d) => d.id === id)

const NUMBERS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, '1': 1, '2': 2, '3': 3, '4': 4 }

/** Nombre d'objets à piocher annoncé par une carte (« deux objets », « 3 cartes objets »…). */
export function objectsToDraw(text: string | undefined) {
  if (!text) return 0
  const m = text.toLowerCase().match(/(un|une|deux|trois|quatre|\d)\s+(?:cartes?\s+)?objets?/)
  return m ? NUMBERS[m[1]] ?? 0 : 0
}
