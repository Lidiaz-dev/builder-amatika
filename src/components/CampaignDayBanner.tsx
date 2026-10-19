import { Link } from 'react-router-dom'
import { DAY_STATUS_LABELS, isOpen, type CrewDayState } from '../lib/groupCampaign'

/** Rappel dans le builder : la bande est inscrite à une campagne, où tout se joue. */
export default function CampaignDayBanner({ state, lock }: { state: CrewDayState; lock: string | null }) {
  const { campaign, day, participant } = state
  const status = participant && day && isOpen(day.status) ? `Journée ${day.number} : ${DAY_STATUS_LABELS[day.status].toLowerCase()}` : null
  return (
    <div className={`campaign-banner notice ${lock ? 'warn' : status ? 'live' : ''}`}>
      <span>
        ⚑ Bande de la campagne <strong>{campaign.name}</strong>
        {status ? ` · ${status}` : ''}
        {lock ? <><br /><span className="small">🔒 {lock}</span></> : status ? <><br /><span className="small">Préparation ouverte : la bande est modifiable.</span></> : null}
      </span>
      <Link className="btn small" to={`/campagnes/${campaign.id}`}>Aller à la campagne</Link>
    </div>
  )
}
