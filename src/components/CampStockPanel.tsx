import { useState } from 'react'
import { equipmentById, itemByKey, type Faction } from '../data'
import { isActive, memberName, profileOf, type CampStock, type Member } from '../lib/crew'
import RarityDot from './RarityDot'
import EquipmentTag from './EquipmentTag'
import InfoTag from './InfoTag'
import RuleText from './RuleText'

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
  const [leaving, setLeaving] = useState<Record<string, { kind: 'sell' | 'store'; text: string }>>({})
  /** Petite animation de sortie, puis l'action. */
  const out = (key: string, kind: 'sell' | 'store', text: string, action: () => void) => {
    if (leaving[key]) return
    setLeaving((l) => ({ ...l, [key]: { kind, text } }))
    window.setTimeout(() => {
      action()
      setLeaving((l) => {
        const n = { ...l }
        delete n[key]
        return n
      })
    }, 450)
  }
  const liClass = (key: string) => (leaving[key] ? `item-out ${leaving[key].kind}` : undefined)
  const badge = (key: string) => (leaving[key] ? <span className={`item-out-badge ${leaving[key].kind}`}>{leaving[key].text}</span> : null)
  const nameOf = (m: Member) => memberName(m) || profileOf(faction, m)?.name || '?'
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

  return (
    <div className="camp-stock">
      {readOnly && !empty && <p className="muted small">Consultation seulement : le coffre se modifie pendant la préparation d'une journée.</p>}
      {empty ? (
        <p className="muted small">Vide. Rangez un objet avec le bouton « Coffre » à côté de lui sur la fiche d'un personnage.</p>
      ) : (
        <ul className="camp-list">
          {Object.entries(counts).map(([id, n]) => {
            const e = equipmentById(id)
            if (!e) return null
            return (
              <li key={id} className={liClass(id)}>
                <span><RarityDot rarity="blanc" /> <EquipmentTag item={e} />{n > 1 && <strong> ×{n}</strong>}</span>
                {!readOnly && <span className="row">
                  {memberSelect(id, id)}
                  <button className="btn small" disabled={!takers(id).length} onClick={() => {
                    const m = pick(id, id)
                    if (m) out(id, 'store', `→ ${nameOf(m)}`, () => onChange(withoutEquipment(id), { ...m, equipment: [...m.equipment, { itemId: id, slot: 'sac' }] }))
                  }}>Donner</button>
                  <button className="btn small ghost" onClick={() => out(id, 'sell', `+${Math.floor(e.price / 2)} PO`, () => onChange(withoutEquipment(id), undefined, { po: Math.floor(e.price / 2) }, `Vente : ${e.name} (coffre du camp)`))} data-tip="Vendre pour la moitié du prix">
                    Vendre {Math.floor(e.price / 2)} PO
                  </button>
                  <button className="icon-btn drop-btn" onClick={() => confirm(`Jeter « ${e.name} » ?`) && onChange(withoutEquipment(id))} aria-label={`Jeter ${e.name}`} data-tip="Jeter, sans revente">×</button>
                </span>}
                {badge(id)}
              </li>
            )
          })}
          {stock.loot.map((l) => {
            const item = itemByKey(l.key)
            const price = item?.price ?? null
            return (
              <li key={l.id} className={liClass(l.id)}>
                <span>
                  <RarityDot rarity={item?.rarity ?? 'blanc'} />{' '}
                  <InfoTag label={item?.name ?? l.key} kicker={item?.category} className="loot-tag"><p><RuleText text={item?.description ?? ''} /></p></InfoTag>
                </span>
                {!readOnly && <span className="row">
                  {memberSelect(l.id)}
                  <button className="btn small" disabled={!active.length} onClick={() => {
                    const m = pick(l.id)
                    if (m) out(l.id, 'store', `→ ${nameOf(m)}`, () => onChange(withoutLoot(l.id), { ...m, loot: [...(m.loot ?? []), { ...l, slot: 'sac' }] }))
                  }}>Donner</button>
                  {price ? (
                    <button className="btn small ghost" onClick={() => out(l.id, 'sell', `+${Math.floor(price / 2)} PO`, () => onChange(withoutLoot(l.id), undefined, { po: Math.floor(price / 2) }, `Vente : ${item?.name} (coffre du camp)`))} data-tip="Vendre pour la moitié du prix">
                      Vendre {Math.floor(price / 2)} PO
                    </button>
                  ) : null}
                  <button className="icon-btn drop-btn" onClick={() => confirm(`Jeter « ${item?.name ?? l.key} » ?`) && onChange(withoutLoot(l.id))} aria-label={`Jeter ${item?.name ?? l.key}`} data-tip="Jeter, sans revente">×</button>
                </span>}
                {badge(l.id)}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
