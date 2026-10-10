import { RARITY_LABELS, type Rarity } from '../data'

/** Pastille de couleur indiquant la rareté d'un objet (même code que les paquets de cartes). */
export default function RarityDot({ rarity }: { rarity: Rarity }) {
  const label = RARITY_LABELS[rarity]
  return <span className={`rarity-dot rarity-${rarity}`} title={label} aria-label={label} role="img" />
}
