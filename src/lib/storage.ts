import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import type { Crew } from './crew'
import { auth, db } from './firebase'

/**
 * Stockage des bandes : collection `crews` de Firestore si Firebase est configuré
 * (une bande par document, rattachée au compte), sinon localStorage (mode local, sans compte).
 */
const LOCAL_KEY = 'amatika.crews'

function readLocal(): Crew[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as Crew[]
  } catch {
    return []
  }
}

function writeLocal(crews: Crew[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(crews))
}

/**
 * Document Firestore : la bande est rangée en JSON dans `data` (Firestore refuse les valeurs
 * `undefined`), avec à côté le propriétaire et de quoi trier.
 */
interface CrewDoc {
  uid: string
  /** Campagne de groupe : permet à l'organisateur de consulter la bande. */
  campaignId: string | null
  name: string
  factionId: string
  updatedAt: string
  data: string
}

const uid = () => {
  const u = auth?.currentUser
  if (!u) throw new Error('Vous devez être connecté pour accéder à vos bandes.')
  return u.uid
}

const fromDoc = (id: string, d: CrewDoc): Crew => ({ ...(JSON.parse(d.data) as Crew), id })

export async function listCrews(): Promise<Crew[]> {
  if (!db) return readLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const snap = await getDocs(query(collection(db, 'crews'), where('uid', '==', uid())))
  return snap.docs.map((d) => fromDoc(d.id, d.data() as CrewDoc)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getCrew(id: string): Promise<Crew | null> {
  if (!db) return readLocal().find((c) => c.id === id) ?? null
  try {
    const snap = await getDoc(doc(db, 'crews', id))
    return snap.exists() ? fromDoc(snap.id, snap.data() as CrewDoc) : null
  } catch (err) {
    // Bande inexistante ou appartenant à un autre compte : les règles Firestore refusent la lecture.
    if ((err as { code?: string }).code === 'permission-denied') return null
    throw err
  }
}

export async function saveCrew(crew: Crew): Promise<Crew> {
  // Un nom proposé et non modifié est gardé tel quel.
  const members = crew.members.map((m) => (m.name.trim() || !m.suggestedName ? m : { ...m, name: m.suggestedName }))
  const saved = { ...crew, members, updatedAt: new Date().toISOString() }
  if (!db) {
    writeLocal([saved, ...readLocal().filter((c) => c.id !== crew.id)])
    return saved
  }
  const data: CrewDoc = { uid: uid(), campaignId: saved.groupCampaign?.id ?? null, name: saved.name, factionId: saved.factionId, updatedAt: saved.updatedAt, data: JSON.stringify(saved) }
  await setDoc(doc(db, 'crews', saved.id), data)
  return saved
}

export async function deleteCrew(id: string): Promise<void> {
  if (!db) {
    writeLocal(readLocal().filter((c) => c.id !== id))
    return
  }
  await deleteDoc(doc(db, 'crews', id))
}

/** Bandes restées dans ce navigateur (créées en mode local, avant la connexion). */
export const localCrews = (): Crew[] => (db ? readLocal() : [])

/** Copie les bandes du navigateur dans le compte, puis les retire du navigateur. */
export async function moveLocalCrewsToAccount(): Promise<number> {
  const crews = readLocal()
  for (const c of crews) await saveCrew(c)
  localStorage.removeItem(LOCAL_KEY)
  return crews.length
}
