import type { Crew } from './crew'
import { applyReceivedGift } from './trade'
import type { Gift } from './groupCampaign'

/** Brouillon du rapport d'après-bataille d'une bande, gardé sur cet appareil. */
export const reportDraftKey = (crewId: string) => `amatika.wizard2.${crewId}`

/** Un rapport d'après-bataille est commencé sur cet appareil. */
export function reportInProgress(crewId: string) {
  try {
    return !!localStorage.getItem(reportDraftKey(crewId))
  } catch {
    return false
  }
}

/**
 * Envois reçus pendant un rapport commencé : ajoutés aussi au brouillon (et à chaque étape déjà
 * faite), qui suit la nouvelle version de la bande. Le rapport continue là où il en était.
 */
export function addGiftsToReportDraft(crewId: string, oldBase: string, newBase: string, gifts: Gift[]) {
  try {
    const raw = localStorage.getItem(reportDraftKey(crewId))
    if (!raw) return
    const snap = JSON.parse(raw) as { base: string; draft: Crew; exits: Crew[] }
    if (snap.base !== oldBase) return
    const add = (c: Crew) => gifts.reduce(applyReceivedGift, c)
    localStorage.setItem(reportDraftKey(crewId), JSON.stringify({ ...snap, base: newBase, draft: add(snap.draft), exits: snap.exits.map((e) => (e ? add(e) : e)) }))
  } catch {
    // Brouillon illisible : il repartira de la bande à jour.
  }
}
