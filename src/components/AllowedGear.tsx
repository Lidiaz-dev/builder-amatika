import { CATEGORY_LABELS, equipment, racialItemsOf, type EquipmentCategory, type Profile } from '../data'

const ORDER: EquipmentCategory[] = ['melee', 'ranged', 'armor', 'shield', 'helmet']

/** Liste de l'équipement commun qu'un profil peut porter, par catégorie. */
export default function AllowedGear({ profile, factionId, unrestricted }: { profile: Profile; factionId: string; unrestricted: boolean }) {
  const allowed = equipment.filter((e) => profile.equipment.includes(e.id))
  const racial = racialItemsOf(factionId).filter((it) => !it.requires || profile.equipment.includes(it.requires))

  return (
    <div className="allowed-gear">
      {unrestricted && <p className="notice small">Mode sans restrictions : voici ce que le profil peut porter selon les règles.</p>}
      {allowed.length === 0 && <p className="muted">Ce profil ne peut porter aucun équipement commun.</p>}
      {ORDER.map((cat) => {
        const list = allowed.filter((e) => e.category === cat)
        return list.length ? (
          <p key={cat}><strong>{CATEGORY_LABELS[cat]} :</strong> {list.map((e) => e.name).join(', ')}</p>
        ) : null
      })}
      {racial.length > 0 && <p><strong>Objet racial :</strong> {racial.map((it) => it.name).join(', ')}</p>}
    </div>
  )
}
