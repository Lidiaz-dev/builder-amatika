import type { ReactNode } from 'react'
import type { Spell } from '../data'
import InfoTag from './InfoTag'
import StatLine from './StatLine'
import RuleText from './RuleText'

/** Détail d'un sort : valeur de lancement, portée, cible, effet ou profil de l'invocation. */
export function SpellDetails({ spell }: { spell: Spell }) {
  return (
    <>
      <p className="spell-facts">
        {spell.value !== null && <span><strong>Lancement :</strong> {spell.value}+</span>}
        {spell.range !== null && <span><strong>Portée :</strong> {spell.range} ps</span>}
        {spell.target && <span><strong>Cible :</strong> {spell.target}</span>}
        {spell.racial && <span><strong>Sort racial :</strong> {spell.racial}</span>}
      </p>
      {spell.description && <p><RuleText text={spell.description} /></p>}
      {spell.summon && (
        <>
          <StatLine stats={spell.summon} />
          {spell.summonSkills && <p className="small"><strong>Règles :</strong> <RuleText text={spell.summonSkills} /></p>}
        </>
      )}
    </>
  )
}

export default function SpellTag({ spell, after }: { spell: Spell; after?: ReactNode }) {
  return (
    <InfoTag label={spell.name} kicker={spell.type} className="spell-tag" after={after}>
      <SpellDetails spell={spell} />
    </InfoTag>
  )
}
