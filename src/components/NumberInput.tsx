interface Props {
  /** Valeur actuelle (null : vide, le texte d'aide s'affiche). */
  value: number | null
  onChange: (v: number) => void
  /** Nom du champ, lu par les lecteurs d'écran. */
  label: string
  min?: number
  max?: number
  /** Pas des boutons − et + (1 par défaut). */
  step?: number
  placeholder?: string
  className?: string
}

/** Champ numérique : on tape la valeur, ou on l'ajuste avec − et +. Utilisé partout sur le site. */
export default function NumberInput({ value, onChange, label, min, max, step = 1, placeholder, className = '' }: Props) {
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
  const current = value ?? min ?? 0
  return (
    <span className={`num-input ${className}`}>
      <button
        type="button"
        className="num-btn"
        onClick={() => onChange(clamp(value === null ? current : current - step))}
        disabled={min !== undefined && value !== null && value <= min}
        aria-label={`${label} : moins ${step}`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          if (e.target.value === '') return onChange(clamp(min ?? 0))
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(clamp(n))
        }}
        aria-label={label}
      />
      <button
        type="button"
        className="num-btn"
        onClick={() => onChange(clamp(value === null ? current : current + step))}
        disabled={max !== undefined && value !== null && value >= max}
        aria-label={`${label} : plus ${step}`}
      >
        +
      </button>
    </span>
  )
}
