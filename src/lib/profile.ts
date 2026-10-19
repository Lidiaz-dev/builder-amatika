import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { updateProfile, type User } from 'firebase/auth'
import { db } from './firebase'
import { listCampaigns } from './groupCampaign'

/** Pseudo affiché à la place de l'email (stocké dans users/{uid} et dans le profil du compte). */
export const PSEUDO_MIN = 2
export const PSEUDO_MAX = 24

export function checkPseudo(pseudo: string): string {
  const p = pseudo.trim().replace(/\s+/g, ' ')
  if (p.length < PSEUDO_MIN || p.length > PSEUDO_MAX) throw new Error(`Le pseudo doit faire entre ${PSEUDO_MIN} et ${PSEUDO_MAX} caractères.`)
  return p
}

/** Profil d'un compte : pseudo et email (pour que l'organisateur puisse retrouver les joueurs). */
export interface UserProfile {
  uid: string
  pseudo: string
  email: string
}

const profileData = (user: User, pseudo: string) => ({
  pseudo,
  pseudoLower: pseudo.toLowerCase(),
  email: (user.email ?? '').toLowerCase(),
  updatedAt: new Date().toISOString(),
})

export async function loadPseudo(user: User): Promise<string | null> {
  if (!db) return null
  const snap = await getDoc(doc(db, 'users', user.uid))
  if (!snap.exists()) return null
  const data = snap.data() as { pseudo?: string; email?: string }
  // Anciens profils sans email : on le complète pour apparaître dans la liste des joueurs.
  if (data.pseudo && !data.email) await setDoc(doc(db, 'users', user.uid), profileData(user, data.pseudo)).catch(() => undefined)
  return data.pseudo ?? null
}

/** Enregistre le pseudo, puis le recopie dans les campagnes où le joueur est inscrit. */
export async function savePseudo(user: User, pseudo: string): Promise<string> {
  const p = checkPseudo(pseudo)
  if (!db) return p
  await setDoc(doc(db, 'users', user.uid), profileData(user, p))
  await updateProfile(user, { displayName: p }).catch(() => undefined)
  if (user.emailVerified) {
    const email = (user.email ?? '').toLowerCase()
    const campaigns = await listCampaigns(user).catch(() => [])
    await Promise.all(
      campaigns
        .filter((c) => c.emails.includes(email))
        .map((c) => updateDoc(doc(db!, 'campaigns', c.id, 'entries', email), { pseudo: p }).catch(() => undefined)),
    )
  }
  return p
}
