import { useState } from 'react'
import { injuries, type Injury } from '../data'
import { drawInjury } from '../lib/campaign'
import RuleText from './RuleText'

interface Props {
  /** Applique la carte choisie. */
  onApply: (card: Injury) => void
  /** « Négociation avec la mort » acceptée : 20 PO payés, la blessure est annulée. */
  onNegotiate?: () => void
}

// Une entrée par nom de carte, les cartes à effet durable en premier.
const GROUPS = [
  { label: 'Blessures durables', match: (c: Injury) => c.lasting },
  { label: 'Sans effet après la bataille', match: (c: Injury) => !c.lasting },
]

/** Choix d'une carte Blessure : celle piochée à la table, ou un tirage virtuel. */
export default function InjuryPicker({ onApply, onNegotiate }: Props) {
  const [card, setCard] = useState<Injury | null>(null)
  const [drawn, setDrawn] = useState(false)

  const pick = (c: Injury | null, virtual: boolean) => {
    setCard(c)
    setDrawn(virtual)
  }

  return (
    <div className="injury-picker">
      <div className="row wrap">
        <select
          value={card && !drawn ? card.id : ''}
          onChange={(e) => pick(injuries.find((c) => c.id === e.target.value) ?? null, false)}
          aria-label="Carte piochée"
        >
          <option value="">Carte piochée à la table…</option>
          {GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {injuries.filter(g.match).map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.kind === 'au-sol' || c.kind === 'assome' ? ` (${c.value})` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="muted small">ou</span>
        <button type="button" className="btn small" onClick={() => pick(drawInjury(), true)}>🂠 Piocher une carte</button>
      </div>

      {card && (
        <div className={`injury-card ${card.lasting ? 'lasting' : ''} ${card.dead ? 'dead' : ''}`}>
          <strong>{drawn ? 'Carte tirée : ' : ''}{card.name}</strong>
          <p><RuleText text={card.description} /></p>
          {!card.lasting && !card.special && <p className="muted small">Aucun effet après la bataille.</p>}
          {card.special === 'multiple' && (
            <p className="notice small">Piochez 2 autres cartes et appliquez les deux : ajoutez-les une par une.</p>
          )}
          {card.special === 'bag' && <p className="notice small">Retirez vous-même l'objet détruit du sac de la figurine.</p>}
          <div className="row">
            {card.special === 'negotiate' ? (
              <>
                <button type="button" className="btn small primary" onClick={() => onNegotiate?.()}>Payer 20 PO</button>
                <button type="button" className="btn small" onClick={() => pick(drawInjury(), true)}>Refuser : piocher une autre carte</button>
              </>
            ) : (
              <button type="button" className="btn small primary" onClick={() => { onApply(card); setCard(null) }}>
                Appliquer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
