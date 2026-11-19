import { useEffect } from 'react'
import { d10 } from '../lib/campaign'
import { getLocked, setLocked } from '../lib/lockedRolls'
import NumberInput from './NumberInput'

interface Props {
  value: number | null
  onChange: (v: number | null) => void
  label?: string
  /** Nombre de faces (10 par défaut). */
  max?: number
  /**
   * Clé du jet : une fois lancé par le site (🎲), le résultat est verrouillé et ne peut plus être
   * relancé ni modifié. Sans clé, le dé reste libre.
   */
  lockKey?: string
}

/** Saisie d'un jet de D10 : on tape le résultat de son dé, ou le site le lance (une seule fois). */
export default function DiceInput({ value, onChange, label = 'Jet de D10', max = 10, lockKey }: Props) {
  const locked = lockKey ? getLocked<number>(lockKey) : undefined

  // Valeur verrouillée : elle s'impose, même si la saisie a été perdue (page rechargée…).
  useEffect(() => {
    if (locked !== undefined && value !== locked) onChange(locked)
  }, [locked, value, onChange])

  if (locked !== undefined) {
    return (
      <span className="dice-input dice-locked" data-tip="Jet lancé par le site : il ne peut plus être relancé.">
        <strong>{locked}</strong> <span aria-label="Verrouillé">🔒</span>
      </span>
    )
  }
  return (
    <span className="dice-input">
      <NumberInput label={label} min={1} max={max} value={value} onChange={onChange} placeholder="–" />
      <button
        type="button"
        className="btn small"
        onClick={() => {
          const v = max === 10 ? d10() : 1 + Math.floor(Math.random() * max)
          if (lockKey) setLocked(lockKey, v)
          onChange(v)
        }}
        title={lockKey ? 'Lancer le dé (une seule fois)' : 'Lancer le dé'}
      >
        🎲
      </button>
    </span>
  )
}
