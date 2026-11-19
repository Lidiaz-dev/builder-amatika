import { useEffect, useState } from 'react'
import { isOpen, listMyGifts, type Gift, type GroupCampaign } from '../lib/groupCampaign'
import Modal from './Modal'
import ItemChip from './ItemChip'

/** Contenu d'un envoi : PO, cristaux, puis les objets (étiquettes habituelles). */
function GiftContent({ g }: { g: Gift }) {
  return (
    <span className="gift-content">
      {g.po > 0 && <span className="gift-amount">{g.po} PO</span>}
      {g.cristaux > 0 && <span className="gift-amount">{g.cristaux} cristal{g.cristaux > 1 ? 'aux' : ''}</span>}
      {g.items.map((i, k) => (i.kind === 'equipment' ? <ItemChip key={k} equipmentId={i.key} /> : <ItemChip key={k} lootKey={i.key} />))}
      {!g.po && !g.cristaux && !g.items.length && <span className="muted">rien</span>}
    </span>
  )
}

const when = (g: Gift) => new Date(g.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/**
 * Boîte aux lettres d'un joueur : encart pour ce qui vient d'arriver, et historique des envois
 * reçus et envoyés (en route, reçus).
 */
export default function Mailbox({ campaign, refresh }: {
  campaign: GroupCampaign
  /** Change quand un envoi est fait ou reçu, pour recharger l'historique. */
  refresh: number
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'recus' | 'envoyes'>('recus')
  const [history, setHistory] = useState<{ received: Gift[]; sent: Gift[] } | null>(null)

  useEffect(() => {
    listMyGifts(campaign.id).then(setHistory).catch(() => setHistory({ received: [], sent: [] }))
  }, [campaign.id, refresh])

  const pendingIn = (history?.received ?? []).filter((g) => !g.claimed)
  const arrival = (g: Gift) => (g.day === campaign.dayNumber && isOpen(campaign.dayStatus) ? `arrivera à la clôture de la journée ${g.day}` : 'arrivera à votre prochaine visite')

  return (
    <>

      <button className="btn small mail-btn" onClick={() => setOpen(true)} data-tip="Envois reçus et envoyés.">
        📬 Boîte aux lettres{pendingIn.length ? ` (${pendingIn.length} en route)` : ''}
      </button>

      <Modal open={open} title="Boîte aux lettres" kicker={campaign.name} onClose={() => setOpen(false)} wide>
        <div className="segmented mail-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'recus'} className={tab === 'recus' ? 'on' : ''} onClick={() => setTab('recus')}>Reçus ({history?.received.length ?? 0})</button>
          <button role="tab" aria-selected={tab === 'envoyes'} className={tab === 'envoyes' ? 'on' : ''} onClick={() => setTab('envoyes')}>Envoyés ({history?.sent.length ?? 0})</button>
        </div>
        {history === null && <p className="muted">Chargement…</p>}
        {history && (
          <ul className="mail-list">
            {(tab === 'recus' ? history.received : history.sent).map((g) => (
              <li key={g.id} className={g.claimed ? '' : 'pending'}>
                <div className="mail-head">
                  <strong>{tab === 'recus' ? `De ${g.fromName}` : `À ${g.toName}`}</strong>
                  <span className="muted small">{when(g)} · {g.day ? `journée ${g.day}` : 'avant la 1re journée'}</span>
                  <span className={`badge ${g.claimed ? 'ok' : ''}`}>{g.claimed ? '✓ Reçu' : tab === 'recus' ? `En route : ${arrival(g)}` : 'En route'}</span>
                </div>
                <GiftContent g={g} />
              </li>
            ))}
            {(tab === 'recus' ? history.received : history.sent).length === 0 && <li className="muted">Rien pour l'instant.</li>}
          </ul>
        )}
      </Modal>
    </>
  )
}

/** Encart « Vous avez reçu… » : ce qui vient d'arriver à cette visite. */
export function MailNotice({ fresh, onDismiss }: { fresh: Gift[]; onDismiss: () => void }) {
  return (
    <>
      {fresh.length > 0 && (
        <div className="mail-notice">
          <span className="mail-icon" aria-hidden="true">📬</span>
          <div>
            <strong>Vous avez reçu {fresh.length > 1 ? `${fresh.length} envois` : 'un envoi'} !</strong>
            <ul>
              {fresh.map((g) => (
                <li key={g.id}><span className="mail-from">{g.fromName}</span> <GiftContent g={g} /></li>
              ))}
            </ul>
            <p className="muted small">PO et cristaux ajoutés au trésor, objets rangés dans le coffre du camp.</p>
          </div>
          <button className="icon-btn" onClick={onDismiss} aria-label="Fermer">×</button>
        </div>
      )}
    </>
  )
}
