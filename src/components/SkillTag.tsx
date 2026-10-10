import { skillByName, TREE_LABELS } from '../data'
import InfoTag from './InfoTag'

/** Étiquette de compétence : un clic ouvre la règle complète. */
export default function SkillTag({ name }: { name: string }) {
  const skill = skillByName(name)
  return (
    <InfoTag label={name} kicker={skill ? TREE_LABELS[skill.tree] ?? skill.tree : undefined}>
      {skill ? (
        <p>{skill.description}</p>
      ) : (
        <p className="muted">Cette compétence n'a pas encore de description dans les règles.</p>
      )}
      {skill?.id === 'eclaireur-x' && <p className="muted small">X est la valeur indiquée après « Éclaireur ».</p>}
    </InfoTag>
  )
}
