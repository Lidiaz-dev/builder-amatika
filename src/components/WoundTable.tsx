import { useState } from 'react'

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Résultat à obtenir sur 1D10 pour blesser : 6+ à force égale à l'endurance, ±1 par point d'écart, entre 2+ et 10+. */
const woundRoll = (strength: number, toughness: number) => Math.min(10, Math.max(2, 6 - strength + toughness))

/** Tableau des blessures : la ligne et la colonne survolées sont mises en évidence. */
export default function WoundTable() {
  const [hover, setHover] = useState<{ f: number; e: number } | null>(null)
  return (
    <div className="wound-table-wrap">
      <table className="wound-table" onMouseLeave={() => setHover(null)}>
        <caption>Résultat à obtenir sur 1D10 pour blesser</caption>
        <thead>
          <tr>
            <th scope="col" className="wound-corner">
              <span>F ↓</span>
              <span>E →</span>
            </th>
            {VALUES.map((e) => (
              <th key={e} scope="col" className={hover?.e === e ? 'on' : ''}>{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {VALUES.map((f) => (
            <tr key={f}>
              <th scope="row" className={hover?.f === f ? 'on' : ''}>{f}</th>
              {VALUES.map((e) => {
                const roll = woundRoll(f, e)
                const cls = [hover && (hover.f === f || hover.e === e) ? 'cross' : '', hover?.f === f && hover.e === e ? 'on' : '', f === e ? 'even' : ''].filter(Boolean).join(' ')
                return (
                  <td key={e} className={cls} onMouseEnter={() => setHover({ f, e })} title={`Force ${f} contre Endurance ${e} : ${roll}+`}>
                    {roll}+
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">6+ quand la force égale l'endurance, puis 1 de moins par point de force en plus, 1 de plus par point d'endurance en plus. Jamais mieux que 2+ ni pire que 10+.</p>
    </div>
  )
}
