import { STAT_COLUMNS, type Equipment, type Profile, type StatKey } from '../data'

export function limitLabel(p: Profile) {
  return p.min === p.max ? String(p.max) : `${p.min}-${p.max}`
}

export function upkeepLabel(p: Profile) {
  if (p.upkeep.cristaux) return `${p.upkeep.cristaux} cristal magique`
  return `${p.upkeep.po} PO${p.upkeep.perLevel ? ' par niveau' : ''}`
}

type Mods = Partial<Record<StatKey, number>>

/** « Svg +2, Com -1 » : bonus et malus vus par le joueur (pour les scores « X+ », baisser le score est un bonus). */
export function formatMods(mods: Mods | undefined) {
  return STAT_COLUMNS.filter((c) => mods?.[c.key])
    .map((c) => {
      const bonus = c.dice ? -mods![c.key]! : mods![c.key]!
      return `${c.label} ${bonus > 0 ? '+' : ''}${bonus}`
    })
    .join(', ')
}

/** Effet d'un équipement commun porté sur la fiche. */
export function equipmentMods(e: Equipment): Mods {
  const mods: Mods = {}
  if (e.save) mods.svg = -e.save
  if (e.move) mods.mou = -e.move
  if (e.encumbered) mods.com = 1
  return mods
}
