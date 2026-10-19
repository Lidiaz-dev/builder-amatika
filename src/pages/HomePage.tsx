import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { DAY_STATUS_LABELS, listCampaigns, type GroupCampaign } from '../lib/groupCampaign'

const TILES = [
  { to: '/bandes', title: 'Mes bandes', text: 'Retrouver et modifier vos récolteurs.', glyph: '⚔' },
  { to: '/regles', title: 'Compendium', text: 'Règles, compétences, équipement et bandes.', glyph: '❦' },
  { to: '/partie', title: 'Assistant de partie', text: 'Piocher les cartes, lancer les dés, suivre les rounds.', glyph: '🂠' },
]

/**
 * Tuile « campagne » : mène à la campagne en cours (journée ouverte, ou campagne unique),
 * sinon à la liste des campagnes.
 */
function useCampaignTile() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<GroupCampaign[]>([])
  useEffect(() => {
    if (!user?.emailVerified) return
    listCampaigns(user).then(setCampaigns).catch(() => setCampaigns([]))
  }, [user])

  const open = campaigns.filter((c) => c.dayStatus && c.dayStatus !== 'cloturee')
  const current = open.length === 1 ? open[0] : open.length === 0 && campaigns.length === 1 ? campaigns[0] : null
  if (current) {
    return {
      to: `/campagnes/${current.id}`,
      title: current.name,
      text: current.dayNumber
        ? `Journée ${current.dayNumber} : ${DAY_STATUS_LABELS[current.dayStatus ?? 'cloturee'].toLowerCase()}.`
        : 'Campagne en cours : aucune journée jouée pour le moment.',
      glyph: '⚑',
    }
  }
  return {
    to: '/campagnes',
    title: 'Campagnes',
    text: open.length > 1 ? `${open.length} campagnes ont une journée en cours.` : 'Vos campagnes, leurs journées et vos rapports à faire.',
    glyph: '⚑',
  }
}

export default function HomePage() {
  const campaignTile = useCampaignTile()
  const tiles = [TILES[0], campaignTile, ...TILES.slice(1)]
  return (
    <section className="home">
      <header className="home-hero">
        <h1>Builder Amatika</h1>
        <p>Rassemblez votre bande de récolteurs de cristaux, consultez les règles et préparez vos parties sur l'île d'Amatika.</p>
      </header>
      <div className="tile-grid">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="tile">
            <span className="tile-glyph">{t.glyph}</span>
            <h2>{t.title}</h2>
            <p>{t.text}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
