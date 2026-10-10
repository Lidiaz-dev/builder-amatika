import { useState } from 'react'

/** Couleur de jetons d'un joueur dans le sac d'activation. */
export interface BagColor {
  id: string
  name: string
  color: string
  /** Nombre de jetons en début de partie (une figurine = un jeton). */
  start: number
  /** Jetons actuellement en jeu (diminue quand une figurine meurt). */
  total: number
  /** Jetons sortis du sac pendant ce round. */
  drawn: number
}

/** Les 10 couleurs de jetons proposées. */
const PALETTE = [
  { name: 'Rouge', color: '#b3261e' },
  { name: 'Bleu', color: '#2f5fae' },
  { name: 'Vert', color: '#3d7a2a' },
  { name: 'Jaune', color: '#e0b420' },
  { name: 'Orange', color: '#d9822b' },
  { name: 'Violet', color: '#7d5a9e' },
  { name: 'Rose', color: '#d77fb0' },
  { name: 'Turquoise', color: '#2a9d8f' },
  { name: 'Noir', color: '#231a14' },
  { name: 'Blanc', color: '#f4efe4' },
]

interface Props {
  colors: BagColor[]
  onChange: (colors: BagColor[]) => void
  onDraw: () => void
  onRefill: () => void
}

/** Sac d'activation : jetons par couleur, pioche au hasard, retour au sac en fin de round. */
export default function ActivationBag({ colors, onChange, onDraw, onRefill }: Props) {
  const inBag = colors.reduce((s, c) => s + Math.max(0, c.total - c.drawn), 0)
  const drawn = colors.reduce((s, c) => s + c.drawn, 0)
  const set = (id: string, patch: Partial<BagColor>) => onChange(colors.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  /** Ligne dont on change la couleur (petite palette ouverte). */
  const [recolor, setRecolor] = useState<string | null>(null)
  const used = (color: string) => colors.some((c) => c.color === color)

  function addColor(p: (typeof PALETTE)[number]) {
    onChange([...colors, { id: crypto.randomUUID(), name: p.name, color: p.color, start: 5, total: 5, drawn: 0 }])
  }

  return (
    <section className="card bag">
      <header className="bag-head">
        <h2>Sac d'activation</h2>
        <span className="muted small">{inBag} jeton{inBag > 1 ? 's' : ''} dans le sac{drawn ? ` · ${drawn} sorti${drawn > 1 ? 's' : ''}` : ''}</span>
      </header>

      {colors.length === 0 ? (
        <p className="muted small">Ajoutez une couleur par joueur, avec un jeton par figurine sur la table.</p>
      ) : (
        <ul className="bag-colors">
          {colors.map((c) => {
            const left = Math.max(0, c.total - c.drawn)
            return (
              <li key={c.id}>
                <span className="bag-swatch-wrap">
                  <button
                    className="bag-swatch"
                    style={{ background: c.color }}
                    onClick={() => setRecolor(recolor === c.id ? null : c.id)}
                    aria-label={`Changer la couleur de ${c.name}`}
                    aria-expanded={recolor === c.id}
                  />
                  {recolor === c.id && (
                    <span className="palette-pop" role="group" aria-label="Couleurs">
                      {PALETTE.map((p) => (
                        <button
                          key={p.color}
                          className={`palette-chip ${p.color === c.color ? 'on' : ''}`}
                          style={{ background: p.color }}
                          disabled={used(p.color) && p.color !== c.color}
                          title={p.name}
                          aria-label={p.name}
                          onClick={() => {
                            // Le nom suit la couleur tant qu'il n'a pas été personnalisé.
                            const renamed = PALETTE.some((x) => x.name === c.name) ? p.name : c.name
                            set(c.id, { color: p.color, name: renamed })
                            setRecolor(null)
                          }}
                        />
                      ))}
                    </span>
                  )}
                </span>
                <input className="bag-name" value={c.name} onChange={(e) => set(c.id, { name: e.target.value })} aria-label="Nom du joueur" placeholder="Nom du joueur" title="Renommez avec le nom du joueur" />
                <label className="bag-start" title="Nombre de jetons en début de partie">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={c.start}
                    onChange={(e) => {
                      const n = Math.max(0, Math.min(20, Number(e.target.value)))
                      set(c.id, { start: n, total: n, drawn: Math.min(c.drawn, n) })
                    }}
                    aria-label={`Jetons de ${c.name}`}
                  />
                  <span className="muted small">jetons</span>
                </label>
                <span className="bag-tokens" aria-label={`${left} jetons dans le sac sur ${c.total}`}>
                  {Array.from({ length: c.total }, (_, i) => (
                    <span key={i} className={`token ${i < left ? '' : 'out'}`} style={{ background: c.color }} />
                  ))}
                  {c.start > c.total && Array.from({ length: c.start - c.total }, (_, i) => <span key={`d${i}`} className="token dead">✝</span>)}
                </span>
                <span className="row bag-actions">
                  <button className="btn small ghost" onClick={() => set(c.id, { drawn: Math.max(0, c.drawn - 1) })} disabled={!c.drawn} title="Remettre un jeton sorti par erreur">↩</button>
                  <button
                    className="btn small ghost danger"
                    onClick={() => set(c.id, { total: Math.max(0, c.total - 1), drawn: Math.min(c.drawn, Math.max(0, c.total - 1)) })}
                    disabled={!c.total}
                    title="Retirer un jeton du pool (figurine morte)"
                  >
                    ✝ −1
                  </button>
                  <button className="icon-btn" onClick={() => confirm(`Retirer la couleur ${c.name} ?`) && onChange(colors.filter((x) => x.id !== c.id))} aria-label={`Supprimer ${c.name}`}>×</button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="row wrap bag-footer">
        <button className="btn primary" onClick={onDraw} disabled={!inBag}>✋ Piocher un jeton</button>
        <button className="btn" onClick={onRefill} disabled={!drawn}>Tout remettre dans le sac</button>
      </div>

      {colors.length < PALETTE.length && (
        <div className="palette-add">
          <span className="muted small">Ajouter une couleur :</span>
          {PALETTE.filter((p) => !used(p.color)).map((p) => (
            <button key={p.color} className={`palette-chip add ${p.name === 'Blanc' || p.name === 'Jaune' ? 'light' : ''}`} style={{ background: p.color }} onClick={() => addColor(p)} title={`Ajouter ${p.name}`} aria-label={`Ajouter ${p.name}`}>
              +
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
