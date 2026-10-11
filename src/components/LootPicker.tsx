import { useState } from 'react'
import { CATEGORY_LABELS, equipment, itemByKey, itemCategories, itemKey, type EquipmentCategory } from '../data'
import RarityDot from './RarityDot'
import RuleText from './RuleText'

export type LootPick =
  | { kind: 'loot'; key: string; paid: boolean; price: number }
  | { kind: 'equipment'; itemId: string; paid: boolean; price: number }

interface Props {
  /** Équipement commun autorisé pour ce profil (null = tout). */
  allowedEquipment: string[] | null
  onPick: (pick: LootPick) => void
  /** Pendant une partie : l'objet est forcément trouvé (pas d'achat). */
  foundOnly?: boolean
}

/** Donner un objet : trouvé (gratuit) ou acheté (déduit du trésor). */
export default function LootPicker({ allowedEquipment, onPick, foundOnly }: Props) {
  const [source, setSource] = useState<'loot' | 'equipment'>('loot')
  const [value, setValue] = useState('')
  const [paid, setPaid] = useState(false)

  const common = equipment.filter((e) => !allowedEquipment || allowedEquipment.includes(e.id))
  const cats = [...new Set(common.map((e) => e.category))] as EquipmentCategory[]
  const selectedLoot = source === 'loot' && value ? itemByKey(value) : undefined
  const selectedEq = source === 'equipment' && value ? equipment.find((e) => e.id === value) : undefined
  const price = selectedLoot?.price ?? selectedEq?.price ?? 0

  const submit = () => {
    if (selectedLoot) onPick({ kind: 'loot', key: value, paid, price })
    if (selectedEq) onPick({ kind: 'equipment', itemId: value, paid, price })
    setValue('')
  }

  return (
    <div className="stack">
      <div className="segmented" role="group" aria-label="Type d'objet">
        <button type="button" className={source === 'loot' ? 'on' : ''} onClick={() => { setSource('loot'); setValue('') }}>Trésor / marché noir</button>
        <button type="button" className={source === 'equipment' ? 'on' : ''} onClick={() => { setSource('equipment'); setValue('') }}>Équipement commun</button>
      </div>

      <select value={value} onChange={(e) => setValue(e.target.value)} aria-label="Objet">
        <option value="">Choisir un objet…</option>
        {source === 'loot'
          ? itemCategories.filter((c) => c.items.length).map((c) => (
              <optgroup key={c.id} label={c.name}>
                {c.items.map((it) => (
                  <option key={it.id} value={itemKey(c.id, it.id)}>
                    {it.name}{it.price !== null ? ` — ${it.price} PO` : ''}
                  </option>
                ))}
              </optgroup>
            ))
          : cats.map((cat) => (
              <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                {common.filter((e) => e.category === cat).map((e) => <option key={e.id} value={e.id}>{e.name} — {e.price} PO</option>)}
              </optgroup>
            ))}
      </select>

      {(selectedLoot || selectedEq) && (
        <div className="injury-card">
          <strong><RarityDot rarity={selectedLoot?.rarity ?? 'blanc'} /> {selectedLoot?.name ?? selectedEq?.name}</strong>
          <p><RuleText text={selectedLoot?.description ?? selectedEq?.rules ?? ''} /></p>
        </div>
      )}

      {!foundOnly && (
        <div className="segmented" role="group" aria-label="Provenance">
          <button type="button" className={!paid ? 'on' : ''} onClick={() => setPaid(false)}>Trouvé (gratuit)</button>
          <button type="button" className={paid ? 'on' : ''} onClick={() => setPaid(true)}>Acheté ({price} PO)</button>
        </div>
      )}
      <div>
        <button type="button" className="btn primary" disabled={!value} onClick={submit}>Donner l'objet</button>
      </div>
    </div>
  )
}
