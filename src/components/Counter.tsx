/** Compteur avec boutons − et + (et saisie directe si `editable`). */
export default function Counter({ label, value, onDelta, steps = [1], big, editable, hideLabel }: {
  label: string
  value: number
  onDelta: (d: number) => void
  steps?: number[]
  big?: boolean
  /** La valeur peut aussi être tapée directement. */
  editable?: boolean
  /** Libellé lu par les lecteurs d'écran mais pas affiché (dans un tableau qui a déjà ses en-têtes). */
  hideLabel?: boolean
}) {
  return (
    <div className={`counter ${big ? 'big' : ''} ${hideLabel ? 'compact' : ''}`}>
      {!hideLabel && <span className="counter-label">{label}</span>}
      <div className="counter-controls">
        <button type="button" className="btn small" onClick={() => onDelta(-Math.min(value, steps[0]))} aria-label={`${label} : moins`} disabled={value <= 0}>−</button>
        {editable ? (
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className="counter-input"
            value={value}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const next = Math.max(0, Math.floor(Number(e.target.value) || 0))
              if (next !== value) onDelta(next - value)
            }}
            aria-label={label}
          />
        ) : (
          <strong>{value}</strong>
        )}
        {steps.map((s) => (
          <button key={s} type="button" className="btn small" onClick={() => onDelta(s)} aria-label={`${label} : plus ${s}`}>+{steps.length > 1 || s !== 1 ? s : ''}</button>
        ))}
      </div>
    </div>
  )
}
