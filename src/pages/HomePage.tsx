import { Link } from 'react-router-dom'

const TILES = [
  { to: '/bandes', title: 'Mes bandes', text: 'Retrouver et modifier vos récolteurs.', glyph: '⚔' },
  { to: '/bandes/nouvelle', title: 'Nouvelle bande', text: 'Recruter une bande pour la campagne.', glyph: '✚' },
  { to: '/regles', title: 'Compendium', text: 'Règles, compétences, équipement et bandes.', glyph: '❦' },
  { to: '/partie', title: 'Assistant de partie', text: 'Piocher les cartes, lancer les dés, suivre les rounds.', glyph: '🂠' },
]

export default function HomePage() {
  return (
    <section className="home">
      <header className="home-hero">
        <h1>Builder Amatika</h1>
        <p>Rassemblez votre bande de récolteurs de cristaux, consultez les règles et préparez vos parties sur l'île d'Amatika.</p>
      </header>
      <div className="tile-grid">
        {TILES.map((t) => (
          <Link key={t.title} to={t.to} className="tile">
            <span className="tile-glyph">{t.glyph}</span>
            <h2>{t.title}</h2>
            <p>{t.text}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
