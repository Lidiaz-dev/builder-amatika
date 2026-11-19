import { equipmentById, factionById, itemByKey } from '../data'
import { memberTitle, profileOf, type Crew, crystalWord } from './crew'

const MAX_ENTRIES = 400
const COFFRE = 'coffre'

/**
 * Compare deux versions d'une bande de campagne et décrit ce qui a changé, en phrases courtes :
 * objets déplacés (personnage ↔ coffre), reçus, retirés, recrutements, départs, niveaux,
 * mouvements du trésor. Sert au journal d'activité consulté par le maître de campagne.
 */
export function describeChanges(before: Crew, after: Crew): string[] {
  if (!after.campaign) return []
  const faction = factionById(after.factionId)
  const lines: string[] = []
  const nameOf = (id: string, crew: Crew) => {
    if (id === COFFRE) return 'le coffre'
    const m = crew.members.find((x) => x.id === id) ?? before.members.find((x) => x.id === id)
    return m ? memberTitle(faction, m) : '?'
  }

  // --- objets de trésor (repérés par leur identifiant : on suit leurs déplacements)
  const lootWhere = (crew: Crew) => {
    const map = new Map<string, { where: string; key: string }>()
    for (const m of crew.members) for (const l of m.loot ?? []) map.set(l.id, { where: m.id, key: l.key })
    for (const l of crew.campaign?.stock?.loot ?? []) map.set(l.id, { where: COFFRE, key: l.key })
    return map
  }
  const lb = lootWhere(before)
  const la = lootWhere(after)
  const lootName = (key: string) => itemByKey(key)?.name ?? key
  for (const [id, a] of la) {
    const b = lb.get(id)
    if (!b) lines.push(a.where === COFFRE ? `« ${lootName(a.key)} » arrive dans le coffre` : `${nameOf(a.where, after)} reçoit « ${lootName(a.key)} »`)
    else if (b.where !== a.where) lines.push(`« ${lootName(a.key)} » : de ${nameOf(b.where, before)} vers ${nameOf(a.where, after)}`)
  }
  for (const [id, b] of lb) if (!la.has(id)) lines.push(`« ${lootName(b.key)} » quitte la bande (${nameOf(b.where, before)})`)

  // --- équipement commun (sans identifiant : on compare les quantités par emplacement)
  const eqCount = (crew: Crew) => {
    const map = new Map<string, Map<string, number>>()
    const add = (itemId: string, where: string) => {
      const inner = map.get(itemId) ?? new Map<string, number>()
      inner.set(where, (inner.get(where) ?? 0) + 1)
      map.set(itemId, inner)
    }
    for (const m of crew.members) for (const r of m.equipment) add(r.itemId, m.id)
    for (const id of crew.campaign?.stock?.equipment ?? []) add(id, COFFRE)
    return map
  }
  const eb = eqCount(before)
  const ea = eqCount(after)
  for (const itemId of new Set([...eb.keys(), ...ea.keys()])) {
    const name = equipmentById(itemId)?.name ?? itemId
    const wb = eb.get(itemId) ?? new Map()
    const wa = ea.get(itemId) ?? new Map()
    const gone: string[] = []
    const came: string[] = []
    for (const w of new Set([...wb.keys(), ...wa.keys()])) {
      const d = (wa.get(w) ?? 0) - (wb.get(w) ?? 0)
      for (let i = 0; i < -d; i++) gone.push(w)
      for (let i = 0; i < d; i++) came.push(w)
    }
    while (gone.length && came.length) lines.push(`« ${name} » : de ${nameOf(gone.shift()!, before)} vers ${nameOf(came.shift()!, after)}`)
    for (const w of came) lines.push(w === COFFRE ? `« ${name} » arrive dans le coffre` : `${nameOf(w, after)} reçoit « ${name} »`)
    for (const w of gone) lines.push(`« ${name} » quitte la bande (${nameOf(w, before)})`)
  }

  // --- membres : recrutements, départs, niveaux, XP
  for (const m of after.members) {
    const old = before.members.find((x) => x.id === m.id)
    const p = profileOf(faction, m)
    if (!old) {
      lines.push(`Recrutement : ${memberTitle(faction, m)}`)
      continue
    }
    if ((old.status ?? 'actif') !== (m.status ?? 'actif')) {
      lines.push(m.status === 'mort' ? `${memberTitle(faction, m)} est mort` : m.status === 'parti' ? `${memberTitle(faction, m)} quitte la bande` : `${memberTitle(faction, m)} est réintégré`)
    }
    for (const a of (m.advances ?? []).filter((x) => !(old.advances ?? []).some((y) => y.id === x.id))) {
      lines.push(`${memberTitle(faction, m)} passe niveau ${a.level} : ${a.label}`)
    }
    if (m.xp !== old.xp) lines.push(`${memberTitle(faction, m)} : ${m.xp > old.xp ? '+' : ''}${m.xp - old.xp} XP (${m.xp} XP)`)
    if ((m.note ?? '') !== (old.note ?? '') && p) lines.push(`${memberTitle(faction, m)} : note changée`)
  }
  for (const m of before.members) if (!after.members.some((x) => x.id === m.id)) lines.push(`${memberTitle(faction, m)} est effacé de la bande`)

  // --- trésor : nouvelles lignes du journal (achats, ventes, envois…)
  const oldLog = before.campaign?.log.length ?? 0
  for (const l of after.campaign.log.slice(oldLog)) {
    const values = [l.po ? `${l.po > 0 ? '+' : ''}${l.po} PO` : '', l.cristaux ? `${l.cristaux > 0 ? '+' : ''}${l.cristaux} ${crystalWord(l.cristaux)}` : '', l.prestige ? `${l.prestige > 0 ? '+' : ''}${l.prestige} prestige` : '']
      .filter(Boolean)
      .join(', ')
    lines.push(`Trésor : ${l.label}${values ? ` (${values})` : ''}`)
  }
  return lines
}

/** Ajoute des lignes au journal d'activité de la bande (les plus anciennes sont oubliées au-delà de 400). */
export function withActivity(crew: Crew, lines: string[], at = new Date().toISOString()): Crew {
  if (!lines.length) return crew
  return { ...crew, activity: [...(crew.activity ?? []), ...lines.map((text) => ({ at, text }))].slice(-MAX_ENTRIES) }
}
