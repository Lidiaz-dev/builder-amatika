/**
 * Points de déploiement : autant de points que de joueurs, aussi éloignés que possible,
 * chacun à la même distance (à vol d'oiseau) de son voisin de droite et de gauche.
 *
 * Les points sont placés sur le pourtour de la table, à 6ps du bord pour que la zone de
 * déploiement (rayon 6ps) tienne sur la table. On cherche, parmi tous les polygones
 * « équilatéraux » qui suivent ce pourtour, celui dont les côtés sont les plus longs.
 */

/** 6 pas = 6 pouces. */
export const DEPLOY_RADIUS = 6 * 2.54

export interface Point {
  x: number
  y: number
}

export interface Deployment {
  points: Point[]
  /** Distance entre deux points voisins (cm). */
  spacing: number
}

/** Pourtour intérieur : rectangle de `w` × `h`, décalé de `inset`, parcouru dans le sens horaire. */
function perimeter(w: number, h: number) {
  const segs = [
    { ax: 0, ay: 0, dx: 1, dy: 0, len: w },
    { ax: w, ay: 0, dx: 0, dy: 1, len: h },
    { ax: w, ay: h, dx: -1, dy: 0, len: w },
    { ax: 0, ay: h, dx: 0, dy: -1, len: h },
  ]
  const P = 2 * (w + h)
  const at = (s: number): Point => {
    let r = ((s % P) + P) % P
    for (const g of segs) {
      if (r <= g.len) return { x: g.ax + g.dx * r, y: g.ay + g.dy * r }
      r -= g.len
    }
    return { x: 0, y: 0 }
  }
  /** Prochain point, en avançant sur le pourtour, situé à `d` à vol d'oiseau de la position `s`. */
  const next = (s: number, d: number): number => {
    const p = at(s)
    // Segment de départ et position dans ce segment.
    let r = ((s % P) + P) % P
    let i = 0
    while (i < 3 && r > segs[i].len) r -= segs[i++].len
    let base = s - r
    for (let k = 0; k < 5; k++) {
      const g = segs[(i + k) % 4]
      const from = k === 0 ? r : 0
      // |A + v·u - p|² = d²  →  u² + 2u(v·(A-p)) + |A-p|² - d² = 0
      const ox = g.ax - p.x
      const oy = g.ay - p.y
      const b = g.dx * ox + g.dy * oy
      const c = ox * ox + oy * oy - d * d
      const disc = b * b - c
      if (disc >= 0) {
        const u = -b + Math.sqrt(disc)
        if (u >= from - 1e-9 && u <= g.len + 1e-9) return base + u
      }
      base += g.len
    }
    return s + P
  }
  return { P, at, next }
}

export function computeDeployment(tableWidth: number, tableLength: number, players: number, inset = DEPLOY_RADIUS): Deployment | null {
  // La longueur de la table est horizontale sur le schéma.
  const w = tableLength - 2 * inset
  const h = tableWidth - 2 * inset
  if (w <= 0 || h <= 0 || players < 2) return null
  const { P, at, next } = perimeter(w, h)

  /** Pour un point de départ donné : plus grande distance qui referme le tour en `players` étapes. */
  const spacingFrom = (s0: number) => {
    let lo = 0
    let hi = P / 2
    for (let it = 0; it < 50; it++) {
      const d = (lo + hi) / 2
      let s = s0
      for (let k = 0; k < players; k++) s = next(s, d)
      if (s - s0 > P) hi = d
      else lo = d
    }
    return lo
  }

  // On essaie tous les points de départ sur le pourtour et on garde l'écartement maximal.
  const samples = 1440
  let best = { d: -1, s0: 0 }
  for (let k = 0; k < samples; k++) {
    const s0 = (P * k) / samples
    const d = spacingFrom(s0)
    if (d <= best.d + 1e-6) continue
    // Le tour doit se refermer exactement : le dernier point est lui aussi à `d` du premier.
    let s = s0
    for (let k = 0; k < players; k++) s = next(s, d)
    if (Math.abs(s - s0 - P) < 0.01) best = { d, s0 }
  }
  const points: Point[] = []
  let s = best.s0
  for (let k = 0; k < players; k++) {
    const p = at(s)
    points.push({ x: p.x + inset, y: p.y + inset })
    s = next(s, best.d)
  }
  return { points, spacing: best.d }
}
