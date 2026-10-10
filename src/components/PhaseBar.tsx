import type { Phase } from '../lib/crew'

const STEPS: { id: Phase | 'apres'; label: string; hint: string }[] = [
  { id: 'preparation', label: 'Préparation', hint: 'Recrutement et équipement avec le budget de départ.' },
  { id: 'gestion', label: 'Entre deux parties', hint: 'Achats, ventes, recrutement, trésor et montées de niveau.' },
  { id: 'partie', label: 'Partie en cours', hint: 'Seuls les participants sont affichés : on note ce qui se passe à la table.' },
  { id: 'apres', label: 'Après la bataille', hint: 'Blessures, butin, entretien, expérience.' },
]

/** Frise des phases d'une bande : où en est-on ? */
export default function PhaseBar({ phase }: { phase: Phase }) {
  const current = STEPS.findIndex((s) => s.id === phase)
  return (
    <ol className={`phase-bar phase-${phase}`} aria-label="Phase de la bande">
      {STEPS.map((s, i) => (
        <li key={s.id} className={i === current ? 'on' : i < current ? 'done' : ''} title={s.hint} aria-current={i === current ? 'step' : undefined}>
          <span className="phase-dot">{s.id === 'partie' ? '⚔' : i + 1}</span>
          <span className="phase-label">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}
