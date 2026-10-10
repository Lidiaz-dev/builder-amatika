import type { Crew } from './crew'
import { supabase } from './supabase'

/**
 * Stockage des bandes : table `crews` de Supabase si configuré,
 * sinon localStorage (mode local, sans compte).
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

interface CrewRow {
  id: string
  data: Crew
}

export async function listCrews(): Promise<Crew[]> {
  if (!supabase) return readLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const { data, error } = await supabase.from('crews').select('id, data').order('updated_at', { ascending: false })
  if (error) throw error
  return (data as CrewRow[]).map((r) => ({ ...r.data, id: r.id }))
}

export async function getCrew(id: string): Promise<Crew | null> {
  if (!supabase) return readLocal().find((c) => c.id === id) ?? null
  const { data, error } = await supabase.from('crews').select('id, data').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? { ...(data as CrewRow).data, id: (data as CrewRow).id } : null
}

export async function saveCrew(crew: Crew): Promise<Crew> {
  // Un nom proposé et non modifié est gardé tel quel.
  const members = crew.members.map((m) => (m.name.trim() || !m.suggestedName ? m : { ...m, name: m.suggestedName }))
  const saved = { ...crew, members, updatedAt: new Date().toISOString() }
  if (!supabase) {
    writeLocal([saved, ...readLocal().filter((c) => c.id !== crew.id)])
    return saved
  }
  const { error } = await supabase.from('crews').upsert({
    id: saved.id,
    name: saved.name,
    faction_id: saved.factionId,
    data: saved,
    updated_at: saved.updatedAt,
  })
  if (error) throw error
  return saved
}

export async function deleteCrew(id: string): Promise<void> {
  if (!supabase) {
    writeLocal(readLocal().filter((c) => c.id !== id))
    return
  }
  const { error } = await supabase.from('crews').delete().eq('id', id)
  if (error) throw error
}
