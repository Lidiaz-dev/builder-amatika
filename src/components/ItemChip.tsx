import type { ReactNode } from 'react'
import { CATEGORY_LABELS, equipmentById, itemByKey } from '../data'
import { equipmentMods, formatMods } from '../lib/format'
import InfoTag from './InfoTag'
import RarityDot from './RarityDot'
import RuleText from './RuleText'

/**
 * Étiquette d'objet, toujours de la même forme : pastille de rareté, nom (clic : effet de l'objet),
 * puis boutons facultatifs (vente, retrait…) collés à droite.
 */
export default function ItemChip({ equipmentId, lootKey, after }: { equipmentId?: string; lootKey?: string; after?: ReactNode }) {
  if (equipmentId) {
    const e = equipmentById(equipmentId)
    if (!e) return <span className="tag item-chip">{equipmentId}</span>
    const weapon = e.category === 'melee' || e.category === 'ranged'
    const mods = formatMods(equipmentMods(e))
    return (
      <InfoTag label={e.name} kicker={CATEGORY_LABELS[e.category]} className="item-chip" icon={<RarityDot rarity="blanc" />} after={after}>
        <p className="spell-facts">
          <span><RarityDot rarity="blanc" /> Commun</span>
          {weapon && e.strength && <span><strong>Force :</strong> {e.strength}</span>}
          {e.range !== undefined && <span><strong>Portée :</strong> {e.range} ps</span>}
          {e.hands > 0 && <span><strong>Mains :</strong> {e.hands}</span>}
          {e.save !== undefined && <span><strong>Sauvegarde :</strong> +{e.save}</span>}
          {e.move !== undefined && <span><strong>Mouvement :</strong> -{e.move}</span>}
          <span><strong>Prix :</strong> {e.price} PO</span>
        </p>
        {e.rules ? <p><RuleText text={e.rules} /></p> : <p className="muted">Pas de règle spéciale.</p>}
        {mods && <p className="notice small">Effet sur la fiche quand il est porté : {mods}</p>}
      </InfoTag>
    )
  }
  const item = lootKey ? itemByKey(lootKey) : undefined
  if (!item) return <span className="tag item-chip">{lootKey}</span>
  const mods = [formatMods(item.mods), ...(item.skills ?? [])].filter(Boolean).join(', ')
  return (
    <InfoTag label={item.name} kicker={item.category} className="item-chip" icon={<RarityDot rarity={item.rarity} />} after={after}>
      <p><RuleText text={item.description} /></p>
      {mods && <p className="notice small">Effet sur la fiche quand il est porté : {mods}</p>}
      {item.price !== null && <p className="small muted">Valeur : {item.price} PO (revente {Math.floor(item.price / 2)} PO)</p>}
    </InfoTag>
  )
}
