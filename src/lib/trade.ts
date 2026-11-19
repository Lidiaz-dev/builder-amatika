import { withTreasury, type Crew } from './crew'
import type { GiftDraft } from './groupCampaign'

/** Emplacement « coffre du camp » d'un objet envoyé. */
export const TO_STOCK = '__coffre'

/** Envoi préparé : objets repérés par leur emplacement pour pouvoir les retirer de la bande. */
export interface PlannedGift extends GiftDraft {
  /** Emplacement de chaque objet ; `owner` : personnage (nom, note, profil) ou « coffre ». */
  sources: { from: string; kind: 'equipment' | 'loot'; ref: string; owner?: string }[]
}

/** Retire de la bande ce qui est envoyé (PO, cristaux, objets) et renvoie les lignes du journal. */
export function applyGifts(crew: Crew, gifts: PlannedGift[], title: string): { crew: Crew; lines: string[] } {
  let c = crew
  const lines: string[] = []
  if (!c.campaign) return { crew: c, lines }
  for (const g of gifts) {
    let members = c.members
    let stock = c.campaign!.stock ?? { equipment: [], loot: [] }
    for (const src of g.sources) {
      if (src.from === TO_STOCK) {
        if (src.kind === 'loot') stock = { ...stock, loot: stock.loot.filter((l) => l.id !== src.ref) }
        else {
          const i = stock.equipment.indexOf(src.ref)
          if (i >= 0) stock = { ...stock, equipment: stock.equipment.filter((_, j) => j !== i) }
        }
      } else {
        members = members.map((m) => {
          if (m.id !== src.from) return m
          if (src.kind === 'loot') return { ...m, loot: (m.loot ?? []).filter((l) => l.id !== src.ref) }
          const i = m.equipment.findIndex((r) => r.itemId === src.ref)
          return i >= 0 ? { ...m, equipment: m.equipment.filter((_, j) => j !== i) } : m
        })
      }
    }
    c = { ...c, members, campaign: { ...c.campaign!, stock } }
    c = withTreasury(c, { po: -g.po, cristaux: -g.cristaux }, `${title} : envoi à ${g.toName}`)
    lines.push(`Envoyé à ${g.toName} : ${plannedText(g)}`)
  }
  return { crew: c, lines }
}

/** Envoi préparé, avec la provenance de chaque objet : « 50 PO, Épée (Gaston « le tireur » (Recrue)) ». */
export function plannedText(g: PlannedGift | GiftDraft & { sources?: PlannedGift['sources'] }) {
  const items = g.items.map((i, k) => {
    const owner = g.sources?.[k]?.owner
    return owner ? `${i.name} (${owner === 'coffre' ? 'du coffre' : owner})` : i.name
  })
  return [g.po ? `${g.po} PO` : '', g.cristaux ? `${g.cristaux} cristal(aux)` : '', ...items].filter(Boolean).join(', ') || 'rien'
}
