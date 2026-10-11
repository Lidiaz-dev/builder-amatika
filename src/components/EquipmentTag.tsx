import { CATEGORY_LABELS, type Equipment } from '../data'
import InfoTag from './InfoTag'
import RarityDot from './RarityDot'
import { equipmentMods, formatMods } from '../lib/format'
import RuleText from './RuleText'

/** Nom d'un équipement commun : un clic ouvre ses caractéristiques et ses règles. */
export default function EquipmentTag({ item }: { item: Equipment }) {
  const weapon = item.category === 'melee' || item.category === 'ranged'
  return (
    <InfoTag label={item.name} kicker={CATEGORY_LABELS[item.category]} className="loot-tag">
      <p className="spell-facts">
        <span><RarityDot rarity="blanc" /> Commun</span>
        {weapon && item.strength && <span><strong>Force :</strong> {item.strength}</span>}
        {item.range !== undefined && <span><strong>Portée :</strong> {item.range} ps</span>}
        {item.hands > 0 && <span><strong>Mains :</strong> {item.hands}</span>}
        {item.save !== undefined && <span><strong>Sauvegarde :</strong> +{item.save}</span>}
        {item.move !== undefined && <span><strong>Mouvement :</strong> -{item.move}</span>}
        <span><strong>Prix :</strong> {item.price} PO</span>
      </p>
      {item.rules ? <p><RuleText text={item.rules} /></p> : <p className="muted">Pas de règle spéciale.</p>}
      {formatMods(equipmentMods(item)) && <p className="notice small">Effet sur la fiche quand il est porté : {formatMods(equipmentMods(item))}</p>}
    </InfoTag>
  )
}
