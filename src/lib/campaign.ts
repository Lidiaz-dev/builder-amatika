import { injuries, injuryById, skills, type Injury, type Profile, type StatKey } from '../data'
import { lootItems, memberSkills, newId, wornItems, type Advance, type Member, type StatMods } from './crew'

/** XP nécessaire pour atteindre les niveaux 2 à 10. */
export const XP_THRESHOLDS = [10, 30, 60, 100, 150, 210, 280, 360, 450]
export const MAX_XP = 450

export const levelForXp = (xp: number) => 1 + XP_THRESHOLDS.filter((t) => xp >= t).length
export const nextThreshold = (xp: number) => XP_THRESHOLDS.find((t) => xp < t) ?? null
/** Montées de niveau gagnées par l'XP mais pas encore appliquées. */
export const pendingLevels = (m: Member) => Math.max(0, levelForXp(m.xp) - m.level)
export const learnsNothing = (profile: Profile, m: Member) =>
  [...profile.skills, ...(m.gainedSkills ?? [])].some((s) => s.toLowerCase() === "n'apprend rien")

export function addXp(profile: Profile, m: Member, amount: number): Member {
  if (learnsNothing(profile, m)) return m
  return { ...m, xp: Math.max(0, Math.min(MAX_XP, m.xp + amount)) }
}

export const d10 = () => 1 + Math.floor(Math.random() * 10)

function addMods(a: StatMods = {}, b: StatMods = {}, sign = 1): StatMods {
  const out: StatMods = { ...a }
  for (const [k, v] of Object.entries(b) as [StatKey, number][]) {
    out[k] = (out[k] ?? 0) + sign * v
    if (out[k] === 0) delete out[k]
  }
  return out
}

// ------------------------------------------------------------------ Blessures

/** Tire une carte au hasard dans le paquet Blessure, en respectant le nombre d'exemplaires. */
export function drawInjury(): Injury {
  const total = injuries.reduce((s, c) => s + c.quantity, 0)
  let r = Math.random() * total
  for (const c of injuries) {
    r -= c.quantity
    if (r < 0) return c
  }
  return injuries[injuries.length - 1]
}

export interface InjuryResult {
  member: Member
  messages: string[]
}

/** Applique les effets durables d'une carte Blessure. */
export function applyInjury(m: Member, card: Injury): InjuryResult {
  const messages: string[] = []
  if (!card.lasting) return { member: m, messages: ['Aucun effet après la bataille.'] }
  const next: Member = { ...m, injuries: [...(m.injuries ?? []), { id: newId(), cardId: card.id, date: new Date().toISOString() }] }
  if (card.mods) next.statMods = addMods(m.statMods, card.mods)
  if (card.gainSkill && !(m.gainedSkills ?? []).includes(card.gainSkill)) {
    next.gainedSkills = [...(m.gainedSkills ?? []), card.gainSkill]
    messages.push(`Gagne la compétence ${card.gainSkill}.`)
  }
  if (card.missNextGame) {
    next.missNextGame = true
    messages.push('Ne jouera pas la prochaine partie.')
  }
  if (card.dead) {
    next.status = 'mort'
    messages.push('La figurine est morte : son équipement est perdu.')
  }
  if (card.mark) {
    const already = (m.injuries ?? []).some((r) => injuryById(r.cardId)?.mark === card.mark)
    if (already && card.leavesOnSecond) {
      next.leavesAfterGame = true
      messages.push("Deuxième fois : la figurine quittera la bande après la partie, une fois son entretien payé.")
    }
  }
  return { member: next, messages }
}

/** Annule une blessure enregistrée (erreur de saisie). */
export function revertInjury(m: Member, recordId: string): Member {
  const record = (m.injuries ?? []).find((r) => r.id === recordId)
  const card = record && injuryById(record.cardId)
  if (!record || !card) return m
  const next: Member = { ...m, injuries: (m.injuries ?? []).filter((r) => r.id !== recordId) }
  if (card.mods) next.statMods = addMods(m.statMods, card.mods, -1)
  if (card.gainSkill) next.gainedSkills = (m.gainedSkills ?? []).filter((s) => s !== card.gainSkill)
  if (card.missNextGame) next.missNextGame = false
  if (card.dead) next.status = 'actif'
  if (card.mark) next.leavesAfterGame = false
  return next
}

// ----------------------------------------------------------- Montées de niveau

export type AdvanceChoice =
  | { kind: 'none' }
  | { kind: 'hit' } // 2 : tir ou corps à corps
  | { kind: 'skill' } // 8, 9 : compétence
  | { kind: 'any' } // 10 : au choix

export interface AdvanceRow {
  roll: number
  label: string
  mods?: StatMods
  choice: AdvanceChoice['kind']
}

/**
 * Table d'évolution (D10). Pour Com, Tir, Agi et Comm (jets « X+ »),
 * progresser d'un point = -1 au score à obtenir.
 */
export const ADVANCE_TABLE: AdvanceRow[] = [
  { roll: 1, label: '+1 en Agilité et en Mouvement', mods: { agi: -1, mou: 1 }, choice: 'none' },
  { roll: 2, label: '-1 au résultat pour toucher au tir OU au corps à corps', choice: 'hit' },
  { roll: 3, label: '+1 en Force', mods: { for: 1 }, choice: 'none' },
  { roll: 4, label: '+1 en Endurance', mods: { end: 1 }, choice: 'none' },
  { roll: 5, label: '+1 point de vie', mods: { pv: 1 }, choice: 'none' },
  { roll: 6, label: '+1 en Commandement', mods: { cmd: -1 }, choice: 'none' },
  { roll: 7, label: '+1 en Attaque', mods: { att: 1 }, choice: 'none' },
  { roll: 8, label: 'Une compétence de ses arbres', choice: 'skill' },
  { roll: 9, label: 'Une compétence de ses arbres', choice: 'skill' },
  { roll: 10, label: 'Résultat au choix', choice: 'any' },
]

/** Compétences qu'un personnage peut apprendre : celles de ses arbres, sauf celles qu'il a déjà et « Chef ». */
export function learnableSkills(profile: Profile, known: string[]) {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const knownSet = new Set(known.map(norm))
  return skills.filter((s) => profile.trees.includes(s.tree) && s.id !== 'chef' && !knownSet.has(norm(s.name)))
}

export interface AdvanceInput {
  roll: number
  /** Pour le 10 : résultat choisi (1 à 9). */
  chosenRoll?: number
  hit?: 'tir' | 'com'
  skill?: string
  spellId?: string
}

export function describeAdvance(input: AdvanceInput) {
  const effective = input.roll === 10 ? input.chosenRoll ?? 0 : input.roll
  const row = ADVANCE_TABLE.find((r) => r.roll === effective)
  if (!row) return { mods: undefined, label: '', complete: false }
  let mods = row.mods
  let label = row.label
  let complete = true
  if (row.choice === 'hit') {
    if (input.hit === 'tir') { mods = { tir: -1 }; label = '-1 pour toucher au tir' }
    else if (input.hit === 'com') { mods = { com: -1 }; label = '-1 pour toucher au corps à corps' }
    else complete = false
  }
  if (row.choice === 'skill') {
    if (input.skill) label = `Nouvelle compétence : ${input.skill}`
    else complete = false
  }
  if (input.roll === 10) label = `10, au choix : ${label}`
  return { mods, label, complete }
}

export function applyAdvance(m: Member, input: AdvanceInput): Member {
  const { mods, label } = describeAdvance(input)
  const level = m.level + 1
  const advance: Advance = { id: newId(), level, roll: input.roll, label, mods, skill: input.skill, spellId: input.spellId }
  const next: Member = { ...m, level, advances: [...(m.advances ?? []), advance] }
  if (mods) next.statMods = addMods(m.statMods, mods)
  if (input.skill) next.gainedSkills = [...(m.gainedSkills ?? []), input.skill]
  if (input.spellId) next.spellIds = [...(m.spellIds ?? []), input.spellId]
  return next
}

/** Annule la dernière montée de niveau. */
export function revertLastAdvance(m: Member): Member {
  const last = (m.advances ?? []).slice(-1)[0]
  if (!last) return m
  const next: Member = { ...m, level: Math.max(1, m.level - 1), advances: (m.advances ?? []).slice(0, -1) }
  if (last.mods) next.statMods = addMods(m.statMods, last.mods, -1)
  if (last.skill) next.gainedSkills = (m.gainedSkills ?? []).filter((s) => s !== last.skill)
  if (last.spellId) next.spellIds = (m.spellIds ?? []).filter((s) => s !== last.spellId)
  return next
}

// ------------------------------------------------------------- Consommables

/**
 * Réserve de poison après la bataille : le poison est perdu si le D10 est inférieur ou égal au seuil.
 * 8 par défaut ; 5 avec Toxine apprivoisée ; 3 avec une sarbacane ou une arme qui ménage le poison (2 avec les deux).
 */
export function poisonThreshold(profile: Profile, m: Member) {
  const tamed = memberSkills(profile, m).some((s) => s.toLowerCase().startsWith('toxine apprivois'))
  const gentle =
    wornItems(m).some((e) => e.id === 'sarbacane') ||
    lootItems(m).some(({ ref, item }) => ref.slot === 'porte' && /perdue que sur un résultat de 1, 2 ou 3/.test(item?.description ?? ''))
  if (gentle) return tamed ? 2 : 3
  return tamed ? 5 : 8
}
