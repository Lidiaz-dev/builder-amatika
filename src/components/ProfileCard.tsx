import { equipment, ROLE_LABELS, TREE_LABELS, type Profile } from '../data'
import StatLine from './StatLine'
import SkillTag from './SkillTag'
import { limitLabel, upkeepLabel } from '../lib/format'

/** Fiche d'un profil de faction, façon carte d'unité. */
export default function ProfileCard({ profile: p }: { profile: Profile }) {
  return (
    <article className="unit-card">
      <header className="unit-band">
        <h3>{p.name}</h3>
        <span className="unit-role">{ROLE_LABELS[p.role]}</span>
      </header>
      <div className="unit-body">
        <p className="unit-facts">
          <span><strong>Coût :</strong> {p.cost} PO</span>
          <span><strong>Effectif :</strong> {limitLabel(p)}</span>
          <span><strong>Entretien :</strong> {upkeepLabel(p)}</span>
          {p.xpValue !== null && <span data-tip="XP gagnée par la figurine adverse pour chaque point de vie retiré à ce profil."><strong>XP par PV retiré :</strong> {p.xpValue}</span>}
        </p>
        <StatLine stats={p.stats} />
        <div className="tags">
          {p.skills.map((s) => <SkillTag key={s} name={s} />)}
          {p.skillChoices.map((c, i) => <span key={i} className="tag">{c.join(' ou ')}</span>)}
        </div>
        {p.notes.length > 0 && <p className="note small">{p.notes.join(' ')}</p>}
      </div>
      <details className="unit-section">
        <summary>Équipement accessible</summary>
        <p>{p.equipment.map((id) => equipment.find((e) => e.id === id)?.name ?? id).join(', ') || 'Aucun'}</p>
      </details>
      <details className="unit-section">
        <summary>Arbres de compétences</summary>
        <p>{p.trees.map((t) => TREE_LABELS[t] ?? t).join(', ') || 'Aucun : ce profil ne progresse pas.'}</p>
      </details>
    </article>
  )
}
