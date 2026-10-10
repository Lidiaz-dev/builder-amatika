import { d10 } from '../lib/campaign'

interface Props {
  value: number | null
  onChange: (v: number | null) => void
  label?: string
  /** Nombre de faces (10 par défaut). */
  max?: number
}

/** Saisie d'un jet de D10 : on tape le résultat de son dé, ou le site le lance. */
export default function DiceInput({ value, onChange, label = 'Jet de D10', max = 10 }: Props) {
  return (
    <span className="dice-input">
      <input
        type="number"
        min={1}
        max={max}
        value={value ?? ''}
        onChange={(e) => {
          const v = Number(e.target.value)
          onChange(e.target.value === '' ? null : Math.min(max, Math.max(1, v)))
        }}
        aria-label={label}
        placeholder="–"
      />
      <button type="button" className="btn small" onClick={() => onChange(max === 10 ? d10() : 1 + Math.floor(Math.random() * max))} title="Lancer le dé">
        🎲
      </button>
    </span>
  )
}
