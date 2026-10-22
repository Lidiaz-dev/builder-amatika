import { useMemo, useState } from 'react'
import { computeDeployment, DEPLOY_RADIUS } from '../lib/deployment'

const PRESETS = [
  { label: '180 × 120', width: 120, length: 180 },
  { label: '120 × 120', width: 120, length: 120 },
]
const PLAYERS = [3, 4, 5, 6, 7, 8]
/** Mêmes teintes que les jetons du sac d'activation. */
const COLORS = ['#b3261e', '#2f5fae', '#3d7a2a', '#e0b420', '#d9822b', '#7d5a9e', '#d77fb0', '#2a9d8f']
const INK = ['#fff', '#fff', '#fff', '#231a14', '#231a14', '#fff', '#231a14', '#fff']

type Unit = 'cm' | 'in'
const INCH = 2.54
/** Valeur (en cm) dans l'unité choisie, sans l'unité. */
const num = (v: number, unit: Unit) =>
  unit === 'cm' ? String(Math.round(v)) : (v / INCH).toLocaleString('fr-FR', { maximumFractionDigits: 1 })
/** Valeur (en cm) dans l'unité choisie, avec l'unité. */
const fmt = (v: number, unit: Unit) => (unit === 'cm' ? `${num(v, unit)} cm` : `${num(v, unit)}"`)
/** Valeur d'un champ de saisie dans l'unité choisie. */
const inputValue = (v: number, unit: Unit) => (unit === 'cm' ? Math.round(v) : Math.round((v / INCH) * 10) / 10)

interface Dim {
  key: string
  /** Point sur le bord. */
  px: number
  py: number
  /** Ligne de cote, à l'extérieur de la table : du coin (1) au point (2). */
  x1: number
  y1: number
  x2: number
  y2: number
  /** Direction vers l'extérieur. */
  nx: number
  ny: number
  value: number
}

/**
 * Cotes pour placer les points au mètre : chaque point sur un bord est mesuré depuis le coin le plus
 * proche de ce bord. Les points d'angle n'en ont pas besoin. Si deux cotes partent du même coin, la
 * seconde est décalée vers l'extérieur.
 */
function edgeDims(points: { x: number; y: number }[], L: number, W: number): Dim[] {
  const eps = 0.5
  const dims: Dim[] = []
  const used = new Map<string, number>()
  const add = (key: string, corner: string, p: { x: number; y: number }, c: { x: number; y: number }, n: { x: number; y: number }, value: number) => {
    if (value < 1) return
    const level = used.get(corner) ?? 0
    used.set(corner, level + 1)
    const off = 7 + level * 6
    dims.push({ key, px: p.x, py: p.y, x1: c.x + n.x * off, y1: c.y + n.y * off, x2: p.x + n.x * off, y2: p.y + n.y * off, nx: n.x, ny: n.y, value })
  }
  // Les cotes les plus courtes d'abord, pour qu'elles restent au plus près de la table.
  const sorted = points.map((p, i) => ({ p, i })).sort((a, b) => Math.min(a.p.x, L - a.p.x) - Math.min(b.p.x, L - b.p.x))
  for (const { p, i } of sorted) {
    const onTop = p.y <= eps
    const onBottom = p.y >= W - eps
    const onLeft = p.x <= eps
    const onRight = p.x >= L - eps
    if ((onTop || onBottom) && !onLeft && !onRight) {
      const y = onTop ? 0 : W
      const n = { x: 0, y: onTop ? -1 : 1 }
      const fromLeft = p.x <= L - p.x
      add(`h${i}`, `${onTop ? 't' : 'b'}${fromLeft ? 'l' : 'r'}`, p, { x: fromLeft ? 0 : L, y }, n, fromLeft ? p.x : L - p.x)
    }
    if ((onLeft || onRight) && !onTop && !onBottom) {
      const x = onLeft ? 0 : L
      const n = { x: onLeft ? -1 : 1, y: 0 }
      const fromTop = p.y <= W - p.y
      add(`v${i}`, `${onLeft ? 'l' : 'r'}${fromTop ? 't' : 'b'}`, p, { x, y: fromTop ? 0 : W }, n, fromTop ? p.y : W - p.y)
    }
  }
  return dims
}

/** Schéma des points de déploiement selon le nombre de joueurs et la taille de la table. */
export default function DeploymentMap() {
  const [players, setPlayers] = useState(6)
  const [width, setWidth] = useState(120)
  const [length, setLength] = useState(180)
  // La longueur est toujours horizontale.
  const W = Math.min(width, length)
  const L = Math.max(width, length)
  const result = useMemo(() => computeDeployment(W, L, players, 0), [W, L, players])
  const pad = 22
  const [unit, setUnit] = useState<Unit>('cm')
  /** Points d'arrivée des Démons sur la ligne centrale : 1 (au 1/2), 2 (aux 1/3) ou 3 (aux 1/4). */
  const [demons, setDemons] = useState(1)
  const demonPoints = Array.from({ length: demons }, (_, i) => ({ x: (L * (i + 1)) / (demons + 1), y: W / 2 }))
  const toCm = (v: number) => (unit === 'cm' ? v : v * INCH)
  const grid = unit === 'cm' ? 10 : 6 * INCH

  return (
    <div className="deploy">
      <div className="deploy-controls">
        <div className="field">
          <span>Joueurs</span>
          <div className="segmented">
            {PLAYERS.map((n) => (
              <button key={n} className={players === n ? 'on' : ''} onClick={() => setPlayers(n)}>{n}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Table ({unit === 'cm' ? 'cm' : 'pouces'})</span>
          <div className="row wrap">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className={`chip ${W === p.width && L === p.length ? 'on' : ''}`}
                onClick={() => { setWidth(p.width); setLength(p.length) }}
              >
                {p.label}
              </button>
            ))}
            <span className="row deploy-size">
              <input type="number" min={0} step={unit === 'cm' ? 10 : 1} value={inputValue(width, unit)} onChange={(e) => setWidth(toCm(Number(e.target.value) || 0))} aria-label="Largeur de la table" />
              ×
              <input type="number" min={0} step={unit === 'cm' ? 10 : 1} value={inputValue(length, unit)} onChange={(e) => setLength(toCm(Number(e.target.value) || 0))} aria-label="Longueur de la table" />
            </span>
          </div>
        </div>
        <div className="field">
          <span>Arrivée des Démons</span>
          <div className="segmented" data-tip="Points sur la ligne centrale : 1 au milieu, 2 aux tiers, 3 aux quarts de la longueur.">
            {[1, 2, 3].map((n) => (
              <button key={n} className={demons === n ? 'on' : ''} onClick={() => setDemons(n)}>{n}</button>
            ))}
          </div>
        </div>
        <div className="field" role="radiogroup" aria-label="Unité des distances">
          <span>Unité</span>
          <div className="segmented">
            <button role="radio" aria-checked={unit === 'cm'} className={unit === 'cm' ? 'on' : ''} onClick={() => setUnit('cm')}>cm</button>
            <button role="radio" aria-checked={unit === 'in'} className={unit === 'in' ? 'on' : ''} onClick={() => setUnit('in')} title="Pouces (1 pouce = 1 pas = 2,54 cm)">"</button>
          </div>
        </div>
      </div>

      {!result ? (
        <p className="error">Table trop petite pour placer les zones de déploiement.</p>
      ) : (
        <>
          <p className="deploy-summary">
            <strong>{players} points</strong>, chacun à <strong>{fmt(result.spacing, unit)}</strong> ({fmt(result.spacing, unit === 'cm' ? 'in' : 'cm')}) de ses deux voisins à vol d'oiseau.
            Zones de déploiement : rayon de 6ps ({fmt(DEPLOY_RADIUS, unit)}) autour de chaque point.
          </p>
          <svg
            className="deploy-map"
            viewBox={`${-pad} ${-pad} ${L + 2 * pad} ${W + 2 * pad}`}
            role="img"
            aria-label={`Schéma de déploiement à ${players} joueurs sur une table de ${fmt(W, unit)} par ${fmt(L, unit)}`}
          >
            <rect x={0} y={0} width={L} height={W} className="deploy-table" rx={1.5} />
            {/* Quadrillage tous les 10 cm, ou tous les 6 pouces. */}
            {Array.from({ length: Math.ceil(L / grid) - 1 }, (_, i) => (
              <line key={`v${i}`} x1={(i + 1) * grid} y1={0} x2={(i + 1) * grid} y2={W} className="deploy-grid" />
            ))}
            {Array.from({ length: Math.ceil(W / grid) - 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={(i + 1) * grid} x2={L} y2={(i + 1) * grid} className="deploy-grid" />
            ))}
            <clipPath id="deploy-clip"><rect x={0} y={0} width={L} height={W} /></clipPath>
            {/* Lignes centrales et centre de la table. */}
            <line x1={L / 2} y1={0} x2={L / 2} y2={W} className="deploy-center-line" />
            <line x1={0} y1={W / 2} x2={L} y2={W / 2} className="deploy-center-line" />
            {/* Points d'arrivée des Démons, répartis sur la ligne centrale. */}
            {demonPoints.map((d, i) => (
              <g key={`d${i}`} className="deploy-demon">
                <rect x={d.x - 3.2} y={d.y - 3.2} width={6.4} height={6.4} transform={`rotate(45 ${d.x} ${d.y})`} />
                <text x={d.x} y={d.y} className="deploy-demon-num" textAnchor="middle" dominantBaseline="central">D{demons > 1 ? i + 1 : ''}</text>
                <text x={d.x} y={d.y + 8} className="deploy-center-text" textAnchor="middle">{num(d.x, unit)}</text>
              </g>
            ))}
            {result.points.map((p, i) => {
              const q = result.points[(i + 1) % players]
              const mx = (p.x + q.x) / 2
              const my = (p.y + q.y) / 2
              return (
                <g key={`l${i}`}>
                  <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="deploy-link" />
                  <text x={mx} y={my} className="deploy-dist" textAnchor="middle" dominantBaseline="middle">{num(result.spacing, unit)}</text>
                </g>
              )
            })}
            {result.points.map((p, i) => (
              <g key={`p${i}`}>
                <circle cx={p.x} cy={p.y} r={DEPLOY_RADIUS} className="deploy-zone" clipPath="url(#deploy-clip)" style={{ fill: COLORS[i], stroke: COLORS[i] }} />
                <circle cx={p.x} cy={p.y} r={4.2} fill={COLORS[i]} className="deploy-dot" />
                <text x={p.x} y={p.y} className="deploy-num" textAnchor="middle" dominantBaseline="central" fill={INK[i]}>{i + 1}</text>
              </g>
            ))}
            {/* Cotes le long des bords : distance de chaque point au coin le plus proche. */}
            {edgeDims(result.points, L, W).map((d) => (
              <g key={d.key}>
                <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} className="deploy-dim" />
                <line x1={d.x1 - d.nx * 1.6} y1={d.y1 - d.ny * 1.6} x2={d.x1 + d.nx * 1.6} y2={d.y1 + d.ny * 1.6} className="deploy-dim" />
                <line x1={d.x2 - d.nx * 1.6} y1={d.y2 - d.ny * 1.6} x2={d.x2 + d.nx * 1.6} y2={d.y2 + d.ny * 1.6} className="deploy-dim" />
                <line x1={d.px} y1={d.py} x2={d.x2} y2={d.y2} className="deploy-dim-guide" />
                <text
                  x={(d.x1 + d.x2) / 2 + d.nx * 3.4}
                  y={(d.y1 + d.y2) / 2 + d.ny * 3.4}
                  className="deploy-dim-text"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={d.ny === 0 ? `rotate(-90 ${(d.x1 + d.x2) / 2 + d.nx * 3.4} ${(d.y1 + d.y2) / 2})` : undefined}
                >
                  {fmt(d.value, unit)}
                </text>
              </g>
            ))}
            <text x={L / 2} y={W + pad - 2} className="deploy-axis" textAnchor="middle">{fmt(L, unit)}</text>
            <text x={-pad + 2.5} y={W / 2} className="deploy-axis" textAnchor="middle" transform={`rotate(-90 ${-pad + 2.5} ${W / 2})`}>{fmt(W, unit)}</text>
          </svg>

          <table className="ref-table deploy-table-list">
            <thead>
              <tr><th>Point</th><th>Depuis le bord gauche</th><th>Depuis le bord du haut</th></tr>
            </thead>
            <tbody>
              {result.points.map((p, i) => (
                <tr key={i}>
                  <td><span className="deploy-chip" style={{ background: COLORS[i], color: INK[i] }}>{i + 1}</span></td>
                  <td>{fmt(p.x, unit)}</td>
                  <td>{fmt(p.y, unit)}</td>
                </tr>
              ))}
              {demonPoints.map((d, i) => (
                <tr key={`d${i}`}>
                  <td><span className="deploy-chip demon">D{demons > 1 ? i + 1 : ''}</span></td>
                  <td>{fmt(d.x, unit)}</td>
                  <td>{fmt(d.y, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            Les points sont sur le bord de la table : la zone de déploiement forme un demi-cercle (un quart de cercle dans un angle). Parmi toutes les dispositions
            où chaque point est à égale distance de ses deux voisins, c'est celle qui les éloigne le plus. Le numéro ne donne pas d'ordre de
            choix : c'est l'initiative qui décide, parmi les points du bord. Le point central sert d'arrivée aux Démons d'Amatika.
          </p>
        </>
      )}
    </div>
  )
}
