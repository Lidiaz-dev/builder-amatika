import { factionById } from '../data'
import type { Crew } from './crew'

/**
 * La bande complète voyage dans le PDF des fiches : elle est rangée, encodée en base64,
 * dans les mots-clés du document. Le PDF reste un PDF normal, et le builder sait le relire.
 */
const MARKER = 'AMATIKA-CREW:v1:'

function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function fromBase64(b64: string) {
  const bin = atob(b64)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** Texte à placer dans les mots-clés du PDF. */
export const crewToKeywords = (crew: Crew) => MARKER + toBase64(JSON.stringify(crew))

function checkCrew(data: unknown): Crew {
  const crew = data as Crew
  if (!crew || typeof crew !== 'object' || !Array.isArray(crew.members) || typeof crew.factionId !== 'string') {
    throw new Error("Ce fichier ne contient pas de bande Amatika.")
  }
  if (!factionById(crew.factionId)) throw new Error(`Faction inconnue dans le fichier : ${crew.factionId}.`)
  const now = new Date().toISOString()
  return { ...crew, name: crew.name ?? '', budget: crew.budget ?? 500, createdAt: crew.createdAt ?? now, updatedAt: crew.updatedAt ?? now }
}

/** Lit une bande depuis un PDF de fiches (ou un fichier .json de bande). */
export async function readCrewFile(file: File): Promise<Crew> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  // latin1 : un octet = un caractère. On retire les octets nuls au cas où un lecteur PDF aurait réenregistré en UTF-16.
  const text = new TextDecoder('latin1').decode(bytes).replace(/\0/g, '')
  const found = text.match(/AMATIKA-CREW:v1:([A-Za-z0-9+/=]+)/)
  if (found) {
    try {
      return checkCrew(JSON.parse(fromBase64(found[1])))
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error('Les données de la bande dans ce PDF sont abîmées.')
      throw e
    }
  }
  if (text.trimStart().startsWith('{')) {
    try {
      return checkCrew(JSON.parse(new TextDecoder().decode(bytes)))
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error("Ce fichier n'est pas lisible.")
      throw e
    }
  }
  throw new Error("Aucune bande trouvée dans ce fichier. Utilisez un PDF téléchargé depuis la page Fiches du builder.")
}
