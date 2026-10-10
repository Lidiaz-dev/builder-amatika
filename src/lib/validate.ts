import { equipmentById, factionById, spellById, type Profile } from '../data'
import {
  activeMembers,
  crewCost,
  handsAvailable,
  isChef,
  isMage,
  MAX_ON_TABLE,
  profileOf,
  wornItems,
  type Crew,
  type Member,
  memberName,
} from './crew'
import { pendingLevels } from './campaign'

export type Severity = 'error' | 'warning'

export interface Issue {
  severity: Severity
  message: string
  memberId?: string
}

export function validateMember(profile: Profile, member: Member, inCampaign = false): Issue[] {
  const issues: Issue[] = []
  const err = (message: string) => issues.push({ severity: 'error', message, memberId: member.id })
  const who = memberName(member) || profile.name

  for (const ref of member.equipment) {
    const item = equipmentById(ref.itemId)
    if (!item) err(`${who} : équipement inconnu (${ref.itemId}).`)
    else if (!profile.equipment.includes(item.id)) err(`${who} n'a pas accès à : ${item.name}.`)
  }

  const worn = wornItems(member)
  const melee = worn.filter((e) => e.category === 'melee')
  const ranged = worn.filter((e) => e.category === 'ranged')
  const shields = worn.filter((e) => e.category === 'shield')
  const armors = worn.filter((e) => e.category === 'armor')
  const helmets = worn.filter((e) => e.category === 'helmet')

  if (ranged.length > 1) err(`${who} : une seule arme de tir portée.`)
  if (shields.length > 1) err(`${who} : un seul bouclier.`)
  if (armors.length > 1) err(`${who} : une seule armure (cuir, légère, lourde ou complète).`)
  if (helmets.length > 1) err(`${who} : un seul casque.`)
  if (melee.length > 2) err(`${who} : deux armes de corps à corps au maximum.`)
  if (melee.length > 1 && melee.some((e) => e.exclusiveMelee)) {
    err(`${who} : ${melee.find((e) => e.exclusiveMelee)!.name} ne se combine pas avec une seconde arme de corps à corps.`)
  }

  // Une hallebarde se porte avec un bouclier (utilisé seulement contre les tirs).
  const halberdShield = shields.length > 0 && melee.some((e) => e.shieldVsShots)
  const hands = [...melee, ...ranged, ...shields].reduce((sum, e) => sum + e.hands, 0) - (halberdShield ? 1 : 0)
  const available = handsAvailable(profile, member)
  if (hands > available) {
    err(`${who} : ${hands} mains utilisées pour ${available} disponible${available > 1 ? 's' : ''}. Mettez des objets dans le sac.`)
  }

  profile.skillChoices.forEach((choices, i) => {
    if (!choices.includes(member.skillChoices[i])) err(`${who} : choisissez entre ${choices.join(' ou ')}.`)
  })

  if (isMage(profile) && !inCampaign) {
    const known = (member.spellIds ?? []).filter((id) => spellById(id))
    const expected = profile.startingSpells ?? 2
    if (known.length !== expected) {
      issues.push({
        severity: 'warning',
        message: `${who} : un mage commence avec ${expected} sort${expected > 1 ? 's' : ''} (actuellement ${known.length}).`,
        memberId: member.id,
      })
    }
  }

  if (inCampaign && pendingLevels(member) > 0) {
    issues.push({ severity: 'warning', message: `${who} : montée de niveau à appliquer.`, memberId: member.id })
  }

  if (!member.name.trim()) {
    issues.push({ severity: 'warning', message: `${profile.name} sans nom.`, memberId: member.id })
  }
  return issues
}

export function validateCrew(crew: Crew): Issue[] {
  const faction = factionById(crew.factionId)
  if (!faction) return [{ severity: 'error', message: 'Faction inconnue.' }]
  const issues: Issue[] = []

  if (!crew.name.trim()) issues.push({ severity: 'warning', message: 'La bande n’a pas de nom.' })

  const inCampaign = !!crew.campaign
  const members = activeMembers(crew)

  if (inCampaign) {
    if (crew.campaign!.po < 0) issues.push({ severity: 'error', message: `Trésor négatif : ${crew.campaign!.po} PO.` })
  } else {
    const cost = crewCost(crew)
    if (cost > crew.budget) {
      issues.push({ severity: 'error', message: `Budget dépassé : ${cost} PO pour ${crew.budget} PO.` })
    }
  }

  const chefs = members.filter((m) => isChef(profileOf(faction, m), m))
  if (chefs.length !== 1) {
    issues.push({
      severity: 'error',
      message: chefs.length === 0 && inCampaign
        ? 'La bande n’a plus de chef : désignez son successeur.'
        : `Il faut exactement un chef (actuellement ${chefs.length}).`,
    })
  }

  for (const profile of faction.profiles) {
    if (profile.role === 'chef') continue
    const count = members.filter((m) => m.profileId === profile.id).length
    // En campagne, les pertes peuvent faire passer sous le minimum : simple avertissement.
    if (count < profile.min) {
      issues.push({
        severity: inCampaign ? 'warning' : 'error',
        message: `${profile.name} : minimum ${profile.min} (actuellement ${count}).`,
      })
    }
    if (count > profile.max) {
      issues.push({ severity: 'error', message: `${profile.name} : maximum ${profile.max} (actuellement ${count}).` })
    }
  }

  if (members.length > MAX_ON_TABLE) {
    issues.push({
      severity: 'warning',
      message: `${members.length} membres : seuls ${MAX_ON_TABLE} pourront être déployés en partie.`,
    })
  }

  for (const m of members) {
    const profile = profileOf(faction, m)
    if (!profile) issues.push({ severity: 'error', message: `Profil inconnu : ${m.profileId}.`, memberId: m.id })
    else issues.push(...validateMember(profile, m, inCampaign))
  }
  // Sans restrictions : on signale toujours, mais rien ne bloque.
  return crew.unrestricted ? issues.map((i) => ({ ...i, severity: 'warning' as const })) : issues
}

export const isLegal = (issues: Issue[]) => !issues.some((i) => i.severity === 'error')
