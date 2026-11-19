import { factionById } from '../data'
import { addXp } from './campaign'
import { profileOf, withTreasury, type Crew, crystalWord } from './crew'
import type { Gift, GiftDraft } from './groupCampaign'

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
  return [g.po ? `${g.po} PO` : '', g.cristaux ? `${g.cristaux} ${crystalWord(g.cristaux)}` : '', ...items].filter(Boolean).join(', ') || 'rien'
}

/**
 * Ajoute un envoi reçu à une bande : PO et cristaux au trésor, objets au coffre du camp, XP sur les
 * personnages, retraits demandés par le maître de campagne. L'envoi est noté comme reçu (jamais deux fois).
 */
export function applyReceivedGift(crew: Crew, g: Gift): Crew {
  if (!crew.campaign || (crew.campaign.receivedGifts ?? []).includes(g.id)) return crew
  const camp = crew.campaign
  const stock = camp.stock ?? { equipment: [], loot: [] }
  let next: Crew = {
    ...crew,
    campaign: {
      ...camp,
      receivedGifts: [...(camp.receivedGifts ?? []), g.id],
      stock: {
        equipment: [...stock.equipment, ...g.items.filter((i) => i.kind === 'equipment').map((i) => i.key)],
        loot: [...stock.loot, ...g.items.filter((i) => i.kind === 'loot').map((i, k) => ({ id: `${g.id}-${k}`, key: i.key, slot: 'sac' as const }))],
      },
    },
  }
  // Retraits demandés par le maître de campagne (un objet déjà parti est simplement ignoré).
  for (const r of g.remove ?? []) {
    const c2 = next.campaign!
    if (r.from === TO_STOCK) {
      const st = c2.stock ?? { equipment: [], loot: [] }
      const i = r.kind === 'loot' ? -1 : st.equipment.indexOf(r.ref)
      next = { ...next, campaign: { ...c2, stock: r.kind === 'loot' ? { ...st, loot: st.loot.filter((l) => l.id !== r.ref) } : { ...st, equipment: st.equipment.filter((_, j) => j !== i) } } }
    } else {
      next = {
        ...next,
        members: next.members.map((m) => {
          if (m.id !== r.from) return m
          if (r.kind === 'loot') return { ...m, loot: (m.loot ?? []).filter((l) => l.id !== r.ref) }
          const i = m.equipment.findIndex((e) => e.itemId === r.ref)
          return i >= 0 ? { ...m, equipment: m.equipment.filter((_, j) => j !== i) } : m
        }),
      }
    }
  }
  // XP donnée par le maître de campagne (les figurines qui n'apprennent rien n'en gagnent pas).
  const faction = factionById(next.factionId)
  for (const x of g.xp ?? []) {
    next = { ...next, members: next.members.map((m) => { const p = m.id === x.memberId ? profileOf(faction, m) : undefined; return p ? addXp(p, m, x.amount) : m }) }
  }
  const removed = (g.remove ?? []).length ? ` ; retiré : ${g.remove!.map((r) => r.name).join(', ')}` : ''
  const gainedXp = (g.xp ?? []).length ? ` ; XP : ${g.xp!.map((x) => `${x.name} +${x.amount}`).join(', ')}` : ''
  const label = `Envoi de ${g.fromName} (journée ${g.day})${g.items.length ? ` : ${g.items.map((i) => i.name).join(', ')} au coffre` : ''}${removed}${gainedXp}`
  return withTreasury(next, { po: g.po, cristaux: g.cristaux }, label)
}
