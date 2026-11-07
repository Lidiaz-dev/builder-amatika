import { useEffect, useState } from 'react'
import { factionById, itemByKey, type Rarity } from '../data'
import { isActive, memberName, profileOf, type Crew } from '../lib/crew'
import { DECKS } from '../lib/decks'
import { getCrew } from '../lib/storage'
import type { Entry } from '../lib/groupCampaign'
import ItemChip from './ItemChip'

/** Nombre d'exemplaires de chaque carte (clé d'objet) dans un paquet. */
const copiesIn = (deckId: string) =>
  (DECKS.find((d) => d.id === deckId)?.cards ?? []).reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.ref]: (acc[c.ref] ?? 0) + 1 }), {})
const TREASURE = copiesIn('objets')
const BLACK_MARKET = copiesIn('marche-noir')
const RARITY_ORDER: Rarity[] = ['jaune', 'vert', 'gris', 'blanc']

interface Owned {
  key: string
  holders: string[]
}

/**
 * Maître de campagne : cartes objets que les joueurs possèdent (sur leurs personnages ou au coffre),
 * à sortir des paquets Trésor et Marché noir. Les plus rares en premier.
 */
export default function CardsToRemovePanel({ entries }: { entries: Entry[] }) {
  const [crews, setCrews] = useState<Crew[] | null>(null)
  const [error, setError] = useState('')
  const ids = entries.map((e) => e.crewId).filter((x): x is string => !!x)
  const idsKey = ids.join(',')

  useEffect(() => {
    if (!idsKey) {
      setCrews([])
      return
    }
    Promise.all(idsKey.split(',').map((id) => getCrew(id).catch(() => null)))
      .then((all) => setCrews(all.filter((c): c is Crew => !!c)))
      .catch((e) => setError((e as Error).message))
  }, [idsKey])

  if (error) return <section className="card"><h2>Cartes à retirer</h2><p className="error">{error}</p></section>

  const owned = new Map<string, Owned>()
  const add = (key: string, holder: string) => {
    const o = owned.get(key) ?? { key, holders: [] }
    o.holders.push(holder)
    owned.set(key, o)
  }
  for (const crew of crews ?? []) {
    const faction = factionById(crew.factionId)
    const player = entries.find((e) => e.crewId === crew.id)
    const band = `${crew.name || 'Bande sans nom'}${player?.pseudo ? ` (${player.pseudo})` : ''}`
    for (const m of crew.members.filter(isActive)) {
      for (const l of m.loot ?? []) if (!l.racial) add(l.key, `${band} · ${memberName(m) || profileOf(faction, m)?.name || '?'}`)
    }
    for (const l of crew.campaign?.stock?.loot ?? []) add(l.key, `${band} · coffre`)
  }
  const list = [...owned.values()]
    .map((o) => {
      const item = itemByKey(o.key)
      const deck = (TREASURE[o.key] ?? 0) + (BLACK_MARKET[o.key] ?? 0)
      return { ...o, item, deck, left: deck - o.holders.length }
    })
    .sort((a, b) => RARITY_ORDER.indexOf(a.item?.rarity ?? 'blanc') - RARITY_ORDER.indexOf(b.item?.rarity ?? 'blanc') || a.left - b.left || (a.item?.name ?? '').localeCompare(b.item?.name ?? '', 'fr'))

  return (
    <details className="card cards-to-remove">
      <summary><h2>Cartes à retirer <span className="muted small">({list.reduce((t, o) => t + o.holders.length, 0)})</span></h2></summary>
      <p className="muted small">
        Objets de trésor et du marché noir que possèdent les bandes (personnages actifs et coffre du camp) : sortez ces cartes des paquets.
        Les plus rares d'abord. Les objets raciaux ne sont pas des cartes et ne sont pas listés.
      </p>
      {crews === null && <p className="muted">Chargement des bandes…</p>}
      {crews && list.length === 0 && <p className="muted">Aucun objet de trésor ou du marché noir chez les joueurs.</p>}
      {list.length > 0 && (
        <ul className="cards-list">
          {list.map((o) => (
            <li key={o.key} className={o.left <= 0 ? 'exhausted' : ''}>
              <span className="cards-list-item">
                <ItemChip lootKey={o.key} />
                <strong>×{o.holders.length}</strong>
                {o.deck > 0 ? (
                  <span className={`badge ${o.left <= 0 ? 'ko' : ''}`} data-tip={`Trésor : ${TREASURE[o.key] ?? 0} · Marché noir : ${BLACK_MARKET[o.key] ?? 0}`}>
                    {o.left <= 0 ? `plus aucune carte (${o.deck} au total)` : `${o.left} / ${o.deck} carte${o.deck > 1 ? 's' : ''} restante${o.left > 1 ? 's' : ''}`}
                  </span>
                ) : (
                  <span className="badge" data-tip="Cet objet n'est dans aucun paquet de l'assistant (rareté jaune au marché noir, par exemple).">hors paquets</span>
                )}
              </span>
              <span className="muted small">{o.holders.join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
