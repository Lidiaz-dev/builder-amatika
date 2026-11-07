import { d10 } from '../lib/campaign'
import NumberInput from './NumberInput'

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
      <NumberInput label={label} min={1} max={max} value={value} onChange={onChange} placeholder="–" />
      <button type="button" className="btn small" onClick={() => onChange(max === 10 ? d10() : 1 + Math.floor(Math.random() * max))} title="Lancer le dé">
        🎲
      </button>
    </span>
  )
}
