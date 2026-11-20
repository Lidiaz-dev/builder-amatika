import { useState, type ReactNode } from 'react'
import { equipmentById, itemByKey, type Faction } from '../data'
import { memberTitle, isActive, profileOf, type CampStock, type Member } from '../lib/crew'
import ItemChip from './ItemChip'

interface Props {
  faction: Faction
  members: Member[]
  stock: CampStock
  /** Remet le stock et (éventuellement) un membre à jour, avec un mouvement de trésor. */
  onChange: (stock: CampStock, member?: Member, delta?: { po: number }, label?: string) => void
  /** Consultation seulement (bande verrouillée : partie en cours, nuit…). */
  readOnly?: boolean
  /** Bande sans restrictions : tout le monde peut prendre tout l'équipement. */
  unrestricted?: boolean
}

/**
 * Stock du camp : objets déposés par les personnages entre deux parties.
 * On peut les redonner à un personnage, les vendre ou les jeter. Un objet commun du stock
 * se reprend gratuitement depuis la liste d'achat d'équipement.
 */
export default function CampStockPanel({ faction, members, stock, onChange, readOnly, unrestricted }: Props) {
  const active = members.filter(isActive)
  const [target, setTarget] = useState<Record<string, string>>({})
  const [flashes, setFlashes] = useState<{ id: number; kind: 'sell' | 'store'; text: string }[]>([])
  /** Action appliquée tout de suite, puis une confirmation s'affiche un instant. */
  const out = (_key: string, kind: 'sell' | 'store', text: string, action: () => void) => {
    action()
    const id = Date.now() + Math.random()
    setFlashes((l) => [...l, { id, kind, text }])
    window.setTimeout(() => setFlashes((l) => l.filter((x) => x.id !== id)), 1600)
  }
  const nameOf = (m: Member) => memberTitle(faction, m)
  const counts = stock.equipment.reduce<Record<string, number>>((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {})
  const empty = !stock.equipment.length && !stock.loot.length

  /** Personnages qui peuvent recevoir l'objet : équipement commun autorisé par le profil ; objets spéciaux pour tous. */
  const takers = (equipmentId?: string) =>
    equipmentId && !unrestricted ? active.filter((m) => profileOf(faction, m)?.equipment.includes(equipmentId)) : active
  const pick = (key: string, equipmentId?: string) => {
    const list = takers(equipmentId)
    return list.find((m) => m.id === target[key]) ?? list[0]
  }
  const withoutEquipment = (id: string) => {
    const i = stock.equipment.indexOf(id)
    return { ...stock, equipment: stock.equipment.filter((_, k) => k !== i) }
  }
  const withoutLoot = (lootId: string) => ({ ...stock, loot: stock.loot.filter((l) => l.id !== lootId) })

  const memberSelect = (key: string, equipmentId?: string) => {
    const list = takers(equipmentId)
    if (!list.length) return <span className="muted small">Personne ne peut le porter</span>
    return (
      <select value={pick(key, equipmentId)?.id ?? ''} onChange={(e) => setTarget((t) => ({ ...t, [key]: e.target.value }))} aria-label="Personnage qui reçoit l'objet">
        {list.map((m) => <option key={m.id} value={m.id}>{nameOf(m)}</option>)}
      </select>
    )
  }

  /** Une ligne du coffre : l'objet et sa valeur en haut, puis « Donner à … » et la vente / le rebut. */
  const row = (r: {
    key: string
    chip: ReactNode
    count: number
    value: number | null
    select: ReactNode
    canGive: boolean
    onGive: () => void
    onSell?: () => void
    onDrop: () => void
    name: string
  }) => (
    <li key={r.key} className="camp-item">
      <div className="camp-item-head">
        <span className="camp-item-name">{r.chip}{r.count > 1 && <strong className="camp-count">×{r.count}</strong>}</span>
        {r.value !== null && <span className="muted small">valeur {r.value} PO</span>}
      </div>
      {!readOnly && (
        <div className="camp-item-actions">
          <span className="camp-give">
            <span className="muted small">Donner à</span>
            {r.select}
            <button className="btn small" disabled={!r.canGive} onClick={r.onGive}>Donner</button>
          </span>
          <span className="camp-out">
            {r.onSell && r.value ? (
              <button className="btn small ghost" onClick={r.onSell} data-tip="Vendre pour la moitié du prix">Vendre {Math.floor(r.value / 2)} PO</button>
            ) : null}
            <button className="icon-btn drop-btn" onClick={r.onDrop} aria-label={`Jeter ${r.name}`} data-tip="Jeter, sans revente">×</button>
          </span>
        </div>
      )}
    </li>
  )

  return (
    <div className="camp-stock">
      {flashes.length > 0 && (
        <div className="item-flashes" aria-live="polite">
          {flashes.map((f) => <span key={f.id} className={`item-flash ${f.kind}`}>{f.text}</span>)}
        </div>
      )}
      {readOnly && !empty && <p className="muted small">Consultation seulement : le coffre se modifie pendant la préparation d'une journée.</p>}
      {empty ? (
        <p className="muted small">Vide. Rangez un objet avec le bouton « Coffre » à côté de lui sur la fiche d'un personnage.</p>
      ) : (
        <ul className="camp-list">
          {Object.entries(counts).map(([id, n]) => {
            const e = equipmentById(id)
            if (!e) return null
            return row({
              key: id,
              chip: <ItemChip equipmentId={id} />,
              count: n,
              value: e.price,
              select: memberSelect(id, id),
              canGive: takers(id).length > 0,
              onGive: () => {
                const m = pick(id, id)
                if (m) out(id, 'store', `→ ${nameOf(m)}`, () => onChange(withoutEquipment(id), { ...m, equipment: [...m.equipment, { itemId: id, slot: 'sac' }] }))
              },
              onSell: () => out(id, 'sell', `+${Math.floor(e.price / 2)} PO`, () => onChange(withoutEquipment(id), undefined, { po: Math.floor(e.price / 2) }, `Vente : ${e.name} (coffre du camp)`)),
              onDrop: () => confirm(`Jeter « ${e.name} » ?`) && onChange(withoutEquipment(id)),
              name: e.name,
            })
          })}
          {stock.loot.map((l) => {
            const item = itemByKey(l.key)
            const price = item?.price ?? null
            return row({
              key: l.id,
              chip: <ItemChip lootKey={l.key} />,
              count: 1,
              value: price,
              select: memberSelect(l.id),
              canGive: active.length > 0,
              onGive: () => {
                const m = pick(l.id)
                if (m) out(l.id, 'store', `→ ${nameOf(m)}`, () => onChange(withoutLoot(l.id), { ...m, loot: [...(m.loot ?? []), { ...l, slot: 'sac' }] }))
              },
              onSell: price ? () => out(l.id, 'sell', `+${Math.floor(price / 2)} PO`, () => onChange(withoutLoot(l.id), undefined, { po: Math.floor(price / 2) }, `Vente : ${item?.name} (coffre du camp)`)) : undefined,
              onDrop: () => confirm(`Jeter « ${item?.name ?? l.key} » ?`) && onChange(withoutLoot(l.id)),
              name: item?.name ?? l.key,
            })
          })}
        </ul>
      )}
    </div>
  )
}
