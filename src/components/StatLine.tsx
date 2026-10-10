import { STAT_COLUMNS, type Stats } from '../data'

function formatStat(value: number | null, dice: boolean) {
  if (value === null) return '/'
  return dice ? `${value}+` : String(value)
}

interface Props {
  stats: Stats
  /** Valeurs de base : les caracs modifiées par l'équipement sont mises en évidence. */
  base?: Stats
  /** `table` pour les fiches imprimées, `chips` (cases étiquetées) partout ailleurs. */
  variant?: 'chips' | 'table'
}

export default function StatLine({ stats, base, variant = 'chips' }: Props) {
  if (variant === 'table') {
    return (
      <table className="stat-line">
        <thead>
          <tr>{STAT_COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          <tr>{STAT_COLUMNS.map((c) => <td key={c.key}><span className="stat-cell">{formatStat(stats[c.key], c.dice)}</span></td>)}</tr>
        </tbody>
      </table>
    )
  }
  return (
    <dl className="stat-chips">
      {STAT_COLUMNS.map((c) => {
        const changed = base && base[c.key] !== stats[c.key]
        return (
          <div key={c.key} className={changed ? 'changed' : undefined} title={changed ? `Base : ${formatStat(base[c.key], c.dice)}` : undefined}>
            <dt>{c.label}</dt>
            <dd>{formatStat(stats[c.key], c.dice)}</dd>
          </div>
        )
      })}
    </dl>
  )
}
