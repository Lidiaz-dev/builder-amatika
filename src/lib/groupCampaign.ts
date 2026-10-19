import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { auth, db } from './firebase'
import { newId, type Crew } from './crew'

/**
 * Campagne de groupe : l'organisateur crée la campagne, y inscrit des joueurs (par email),
 * puis lance des journées avec une partie des bandes. Une fois la journée close, chaque
 * participant remplit et valide sa feuille ; quand toutes sont validées, la journée est validée.
 *
 * Firestore :
 * - campaigns/{id}                        nom, emails des joueurs, journée en cours
 * - campaigns/{id}/entries/{email}        inscription d'un joueur et de sa bande (une par joueur)
 * - campaigns/{id}/days/{n}               journée n : participants et statut
 * - campaigns/{id}/days/{n}/sheets/{email} rapport de fin de nuit validé par un participant
 */

/** Seul ce compte peut créer des campagnes et y inscrire des joueurs (voir aussi firestore.rules). */
export const ADMIN_EMAIL = 'lidiaz.video@gmail.com'

/**
 * Déroulé d'une journée :
 * préparation (les joueurs la rejoignent et préparent leur bande) → en cours (partie notée en direct)
 * → nuit (chaque joueur fait sa récupération puis son rapport : XP, niveaux) → clôturée.
 */
export type DayStatus = 'preparation' | 'en-cours' | 'nuit' | 'cloturee'

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  preparation: 'Préparation',
  'en-cours': 'En cours',
  nuit: 'Nuit',
  cloturee: 'Clôturée',
}

/** Anciennes journées (avant la phase de nuit) : « feuilles » = nuit, « validee » = clôturée. */
const LEGACY_STATUS: Record<string, DayStatus> = { feuilles: 'nuit', validee: 'cloturee' }
export const normStatus = (s: string | null | undefined): DayStatus | null => (s ? LEGACY_STATUS[s] ?? (s as DayStatus) : null)
/** Journée commencée et pas encore clôturée. */
export const isOpen = (s: DayStatus | null) => !!s && s !== 'cloturee'

export interface GroupCampaign {
  id: string
  name: string
  createdAt: string
  /** Emails (minuscules) des joueurs inscrits. */
  emails: string[]
  /** Dernière journée lancée (0 : aucune). */
  dayNumber: number
  dayStatus: DayStatus | null
}

export interface Entry {
  email: string
  /** Pseudo du joueur, affiché à la place de son email. */
  pseudo?: string
  uid?: string
  crewId?: string
  crewName?: string
  factionId?: string
  updatedAt?: string
  /** La bande est validée pour la campagne (son trésor de départ est fixé) : elle peut jouer les journées. */
  ready?: boolean
}

export interface Day {
  number: number
  status: DayStatus
  /** Emails des joueurs qui ont rejoint la journée. */
  participants: string[]
  createdAt: string
  launchedAt?: string
  nightAt?: string
  closedAt?: string
}

export interface Sheet {
  email: string
  pseudo?: string
  uid: string
  crewId: string
  crewName: string
  validatedAt: string
  /** Résumé de la feuille (lignes du bilan d'après-bataille). */
  lines: string[]
}

const norm = (email: string) => email.trim().toLowerCase()
const myEmail = () => norm(auth?.currentUser?.email ?? '')

export const isAdmin = (user: User | null) => !!user && norm(user.email ?? '') === ADMIN_EMAIL && user.emailVerified
/** Compte de l'organisateur dont l'adresse n'est pas encore vérifiée (connexion par mot de passe). */
export const adminNeedsVerification = (user: User | null) => !!user && norm(user.email ?? '') === ADMIN_EMAIL && !user.emailVerified

function database() {
  if (!db) throw new Error('Les campagnes nécessitent les comptes (Firebase).')
  return db
}

const campaignRef = (id: string) => doc(database(), 'campaigns', id)
const entryRef = (id: string, email: string) => doc(database(), 'campaigns', id, 'entries', norm(email))
const dayRef = (id: string, n: number) => doc(database(), 'campaigns', id, 'days', String(n))
const sheetRef = (id: string, n: number, email: string) => doc(database(), 'campaigns', id, 'days', String(n), 'sheets', norm(email))

/** Campagnes visibles : toutes pour l'organisateur, sinon celles où l'on est inscrit. */
export async function listCampaigns(user: User): Promise<GroupCampaign[]> {
  const col = collection(database(), 'campaigns')
  const snap = await getDocs(isAdmin(user) ? col : query(col, where('emails', 'array-contains', norm(user.email ?? ''))))
  return snap.docs.map((d) => fromCampaign(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const fromCampaign = (id: string, data: unknown): GroupCampaign => {
  const c = data as Omit<GroupCampaign, 'id'>
  return { ...c, id, dayStatus: normStatus(c.dayStatus) }
}
const fromDay = (data: unknown): Day => {
  const d = data as Day & { startedAt?: string }
  return { ...d, status: normStatus(d.status) ?? 'cloturee', createdAt: d.createdAt ?? d.startedAt ?? '' }
}

export async function getCampaign(id: string): Promise<GroupCampaign | null> {
  try {
    const snap = await getDoc(campaignRef(id))
    return snap.exists() ? fromCampaign(snap.id, snap.data()) : null
  } catch (err) {
    if ((err as { code?: string }).code === 'permission-denied') return null
    throw err
  }
}

export async function createCampaign(name: string): Promise<string> {
  const id = newId()
  await setDoc(campaignRef(id), { name: name.trim(), createdAt: new Date().toISOString(), emails: [], dayNumber: 0, dayStatus: null })
  return id
}

export async function renameCampaign(id: string, name: string) {
  await updateDoc(campaignRef(id), { name: name.trim() })
}

/**
 * Annule (supprime) une campagne et tout son contenu : inscriptions, journées, feuilles.
 * Les bandes des joueurs ne sont pas supprimées.
 */
export async function deleteCampaign(id: string) {
  const d = database()
  const [entries, days] = await Promise.all([
    getDocs(collection(d, 'campaigns', id, 'entries')),
    getDocs(collection(d, 'campaigns', id, 'days')),
  ])
  const sheets = await Promise.all(days.docs.map((day) => getDocs(collection(d, 'campaigns', id, 'days', day.id, 'sheets'))))
  const refs = [...sheets.flatMap((s) => s.docs.map((x) => x.ref)), ...days.docs.map((x) => x.ref), ...entries.docs.map((x) => x.ref)]
  // Lots de 400 suppressions (limite Firestore : 500 opérations par lot).
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(d)
    refs.slice(i, i + 400).forEach((r) => batch.delete(r))
    await batch.commit()
  }
  await deleteDoc(campaignRef(id))
}

/**
 * Annule la journée en cours (pas encore validée) : elle est supprimée avec ses feuilles et la
 * campagne revient à la journée précédente. Les bilans déjà appliqués aux bandes ne sont pas défaits.
 */
export async function cancelDay(c: GroupCampaign) {
  if (!c.dayNumber || !isOpen(c.dayStatus)) throw new Error("Il n'y a pas de journée en cours à annuler.")
  const sheets = await getDocs(collection(database(), 'campaigns', c.id, 'days', String(c.dayNumber), 'sheets'))
  const batch = writeBatch(database())
  sheets.docs.forEach((s) => batch.delete(s.ref))
  batch.delete(dayRef(c.id, c.dayNumber))
  batch.update(campaignRef(c.id), { dayNumber: c.dayNumber - 1, dayStatus: c.dayNumber > 1 ? 'cloturee' : null })
  await batch.commit()
}

export async function addPlayer(id: string, email: string, pseudo?: string) {
  const e = norm(email)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Cette adresse email n'est pas valide.")
  const batch = writeBatch(database())
  batch.set(entryRef(id, e), pseudo ? { email: e, pseudo } : { email: e })
  batch.update(campaignRef(id), { emails: arrayUnion(e) })
  await batch.commit()
}

/** Retire un joueur (par exemple pour un reroll : il pourra être réinscrit avec une nouvelle bande). */
export async function removePlayer(id: string, email: string) {
  const batch = writeBatch(database())
  batch.delete(entryRef(id, email))
  batch.update(campaignRef(id), { emails: arrayRemove(norm(email)) })
  await batch.commit()
}

export async function listEntries(id: string): Promise<Entry[]> {
  const snap = await getDocs(collection(database(), 'campaigns', id, 'entries'))
  return snap.docs.map((d) => d.data() as Entry).sort((a, b) => a.email.localeCompare(b.email))
}

export async function getMyEntry(id: string): Promise<Entry | null> {
  const snap = await getDoc(entryRef(id, myEmail()))
  return snap.exists() ? (snap.data() as Entry) : null
}

/** Inscrit (ou remplace) la bande du joueur connecté dans la campagne. */
export async function registerCrew(id: string, crew: Crew) {
  const u = auth?.currentUser
  if (!u) throw new Error('Vous devez être connecté.')
  await setDoc(entryRef(id, myEmail()), {
    email: myEmail(),
    pseudo: u.displayName ?? '',
    uid: u.uid,
    crewId: crew.id,
    crewName: crew.name || 'Bande sans nom',
    factionId: crew.factionId,
    updatedAt: new Date().toISOString(),
    ready: !!crew.campaign,
  })
}

export async function getDay(id: string, n: number): Promise<Day | null> {
  if (n < 1) return null
  const snap = await getDoc(dayRef(id, n))
  return snap.exists() ? fromDay(snap.data()) : null
}

export async function listDays(id: string, upTo: number): Promise<Day[]> {
  const days = await Promise.all(Array.from({ length: upTo }, (_, i) => getDay(id, i + 1)))
  return days.filter((d): d is Day => !!d).reverse()
}

/** Organisateur : crée la journée suivante, que les joueurs peuvent rejoindre et préparer. */
export async function createDay(c: GroupCampaign) {
  if (isOpen(c.dayStatus)) throw new Error("La journée en cours n'est pas encore clôturée.")
  const n = c.dayNumber + 1
  const batch = writeBatch(database())
  batch.set(dayRef(c.id, n), { number: n, status: 'preparation', participants: [], createdAt: new Date().toISOString() })
  batch.update(campaignRef(c.id), { dayNumber: n, dayStatus: 'preparation' })
  await batch.commit()
}

/** Joueur : rejoint (ou quitte) la journée en préparation. */
export async function joinDay(c: GroupCampaign, join: boolean) {
  await updateDoc(dayRef(c.id, c.dayNumber), { participants: join ? arrayUnion(myEmail()) : arrayRemove(myEmail()) })
}

async function setStatus(c: GroupCampaign, status: DayStatus, stamp: string) {
  const batch = writeBatch(database())
  batch.update(dayRef(c.id, c.dayNumber), { status, [stamp]: new Date().toISOString() })
  batch.update(campaignRef(c.id), { dayStatus: status })
  await batch.commit()
}

/** Organisateur : lance la journée (la préparation est verrouillée, les parties commencent). */
export const launchDay = (c: GroupCampaign) => setStatus(c, 'en-cours', 'launchedAt')
/** Organisateur : ouvre la phase de nuit (récupération puis rapport de chaque joueur). */
export const startNight = (c: GroupCampaign) => setStatus(c, 'nuit', 'nightAt')
/** Organisateur : clôture la journée une fois tous les rapports validés. */
export const closeDay = (c: GroupCampaign) => setStatus(c, 'cloturee', 'closedAt')

export async function listSheets(id: string, n: number): Promise<Sheet[]> {
  const snap = await getDocs(collection(database(), 'campaigns', id, 'days', String(n), 'sheets'))
  return snap.docs.map((d) => d.data() as Sheet)
}

export async function getMySheet(id: string, n: number): Promise<Sheet | null> {
  const snap = await getDoc(sheetRef(id, n, myEmail()))
  return snap.exists() ? (snap.data() as Sheet) : null
}

/** Situation de la bande dans sa campagne de groupe (pour le builder et la liste des bandes). */
export interface CrewDayState {
  campaign: GroupCampaign
  day: Day | null
  /** La bande a rejoint la journée en cours. */
  participant: boolean
  /** Bande inscrite et validée : elle peut rejoindre les journées. */
  ready: boolean
  sheet: Sheet | null
}

export async function crewDayState(crew: Pick<Crew, 'id' | 'groupCampaign'>): Promise<CrewDayState | null> {
  const link = crew.groupCampaign
  if (!link || !db || !auth?.currentUser) return null
  const campaign = await getCampaign(link.id)
  if (!campaign) return null
  const entry = await getMyEntry(link.id).catch(() => null)
  // La bande a été remplacée (reroll) ou le joueur retiré : elle ne fait plus partie de la campagne.
  if (!entry || entry.crewId !== crew.id) return null
  const day = await getDay(link.id, campaign.dayNumber)
  const participant = !!day && isOpen(day.status) && day.participants.includes(myEmail())
  const sheet = participant && day?.status === 'nuit' ? await getMySheet(link.id, day.number) : null
  return { campaign, day, participant, sheet, ready: !!entry.ready }
}

/** Enregistre le rapport de fin de nuit du joueur connecté si sa bande doit en rendre un. */
export async function submitSheetIfNeeded(crew: Crew, lines: string[]): Promise<boolean> {
  const state = await crewDayState(crew).catch(() => null)
  if (!state?.participant || state.day?.status !== 'nuit') return false
  const u = auth!.currentUser!
  await setDoc(sheetRef(state.campaign.id, state.day.number, myEmail()), {
    email: myEmail(),
    pseudo: u.displayName ?? '',
    uid: u.uid,
    crewId: crew.id,
    crewName: crew.name || 'Bande sans nom',
    validatedAt: new Date().toISOString(),
    lines,
  })
  return true
}

/**
 * Une bande de campagne déjà validée ne se modifie (équipement, recrutement, achats) que pendant
 * la préparation d'une journée qu'elle a rejointe. Renvoie la raison du verrouillage, ou null.
 */
export function lockReason(crew: Pick<Crew, 'campaign' | 'groupCampaign'>, state: CrewDayState | null): string | null {
  if (!crew.groupCampaign || !crew.campaign) return null
  if (!state) return null
  if (state.participant && state.day?.status === 'preparation') return null
  if (state.participant && state.day?.status === 'en-cours') return 'Partie en cours : notez-la depuis la campagne.'
  if (state.participant && state.day?.status === 'nuit') return 'Phase de nuit : faites votre récupération et votre rapport depuis la campagne.'
  return "Bande de campagne : elle se modifie seulement pendant la préparation d'une journée qu'elle a rejointe."
}

/** Organisateur : comptes inscrits sur l'appli (ceux qui ont choisi un pseudo). */
export async function listUsers(): Promise<{ uid: string; pseudo: string; email: string }[]> {
  const snap = await getDocs(collection(database(), 'users'))
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as { pseudo?: string; email?: string }) }))
    .filter((u): u is { uid: string; pseudo: string; email: string } => !!u.pseudo && !!u.email)
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'))
}
