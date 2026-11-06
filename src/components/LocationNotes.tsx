import { DECKS } from '../lib/decks'
import { LOCATION_ADVICE, LOCATION_NOTES } from '../lib/locationNotes'

/** Encadrés de couleur : forces et faiblesses de chaque lieu d'intérêt. */
export default function LocationNotes() {
  return (
    <section className="location-notes">
      <h2>Forces et faiblesses des lieux</h2>
      <div className="location-notes-grid">
        {LOCATION_NOTES.map((n) => {
          const deck = DECKS.find((d) => d.id === n.id)
          if (!deck) return null
          return (
            <article key={n.id} className="location-note" style={{ ['--deck' as string]: deck.color }}>
              <header>
                <h3>{deck.name}</h3>
                <span className="location-note-stats">
                  <span data-tip="Valeur moyenne d'une carte piochée">≈ {n.gain}</span>
                  <span data-tip="Chances qu'une carte soit un piège ou fasse sortir un monstre">⚠ {n.risk}</span>
                </span>
              </header>
              <ul>
                {n.pros.map((p) => <li key={p} className="pro">{p}</li>)}
                {n.cons.map((c) => <li key={c} className="con">{c}</li>)}
              </ul>
            </article>
          )
        })}
      </div>
      <dl className="location-advice">
        {LOCATION_ADVICE.map(([k, v]) => [<dt key={`t${k}`}>{k}</dt>, <dd key={`d${k}`}>{v}</dd>])}
      </dl>
      <p className="muted small">Moyennes calculées sur les cartes des paquets : 41,8 PO par objet, 137,5 PO par cristal brut, 50 % de réussite aux tests.</p>
    </section>
  )
}
