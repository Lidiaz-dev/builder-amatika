import { useEffect, useState } from 'react'
import { isOpen, listMyGifts, type Gift, type GroupCampaign } from '../lib/groupCampaign'
import Modal from './Modal'
import ItemChip from './ItemChip'

/** Contenu d'un envoi : PO, cristaux, puis les objets (étiquettes habituelles). */
function GiftContent({ g }: { g: Gift }) {
  return (
    <span className="gift-content">
      {g.po > 0 && <span className="gift-amount">+{g.po} PO</span>}
      {g.po < 0 && <span className="gift-removed">{g.po} PO</span>}
      {g.cristaux > 0 && <span className="gift-amount">+{g.cristaux} cristal{g.cristaux > 1 ? 'aux' : ''}</span>}
      {g.cristaux < 0 && <span className="gift-removed">{g.cristaux} cristal{g.cristaux < -1 ? 'aux' : ''}</span>}
      {g.items.map((i, k) => (i.kind === 'equipment' ? <ItemChip key={k} equipmentId={i.key} /> : <ItemChip key={k} lootKey={i.key} />))}
      {g.po === 0 && g.cristaux === 0 && !g.items.length && !(g.remove ?? []).length && !(g.xp ?? []).length && <span className="muted">rien</span>}
      {(g.xp ?? []).map((x, k) => <span key={`x${k}`} className="gift-amount">{x.name} +{x.amount} XP</span>)}
      {(g.remove ?? []).map((r, k) => <span key={`r${k}`} className="gift-removed" data-tip={`Retiré : ${r.owner}`}>− {r.name}</span>)}
      {g.message && <q className="gift-message">{g.message}</q>}
    </span>
  )
}

const when = (g: Gift) => new Date(g.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/**
 * Boîte aux lettres d'un joueur : encart pour ce qui vient d'arriver, et historique des envois
 * reçus et envoyés.
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

  // Envoi fait pendant une journée (rapport) : ajouté à la clôture de cette journée ; sinon, aussitôt.
  const waiting = (g: Gift) => !g.claimed && !g.admin && g.day === campaign.dayNumber && isOpen(campaign.dayStatus)
  const status = (g: Gift) =>
    g.claimed
      ? tab === 'recus' ? '✓ Ajouté à votre bande' : '✓ Ajouté à sa bande'
      : waiting(g) ? `Ajouté à la clôture de la journée ${g.day}` : tab === 'recus' ? 'Ajouté à l\'ouverture de votre bande' : 'Envoyé'

  return (
    <>

      <button className="btn small mail-btn" onClick={() => setOpen(true)} data-tip="Envois reçus et envoyés.">
        📬 Boîte aux lettres
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
                  <span className={`badge ${g.claimed ? 'ok' : ''}`}>{status(g)}</span>
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

const SEEN = 'amatika.mail.seen'
const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? '[]') as string[]
  } catch {
    return []
  }
}

/**
 * Encart « Vous avez reçu… » : envois déjà ajoutés à la bande que le joueur n'a pas encore vus.
 * Il disparaît quand on le ferme (mémorisé dans le navigateur).
 */
export function MailNotice({ campaignId }: { campaignId: string }) {
  const [fresh, setFresh] = useState<Gift[]>([])
  useEffect(() => {
    const seen = new Set(readSeen())
    listMyGifts(campaignId)
      .then((h) => setFresh(h.received.filter((g) => g.claimed && !seen.has(g.id))))
      .catch(() => setFresh([]))
  }, [campaignId])
  const dismiss = () => {
    try {
      localStorage.setItem(SEEN, JSON.stringify([...readSeen(), ...fresh.map((g) => g.id)].slice(-300)))
    } catch {
      // stockage indisponible : l'encart reviendra
    }
    setFresh([])
  }
  if (!fresh.length) return null
  return (
    <div className="mail-notice">
      <span className="mail-icon" aria-hidden="true">📬</span>
      <div>
        <strong>Vous avez reçu {fresh.length > 1 ? `${fresh.length} envois` : 'un envoi'} !</strong>
        <ul>
          {fresh.map((g) => (
            <li key={g.id}><span className="mail-from">{g.fromName}</span> <GiftContent g={g} /></li>
          ))}
        </ul>
        <p className="muted small">Déjà appliqué à votre bande : PO et cristaux au trésor, objets reçus dans le coffre du camp, XP sur les personnages.</p>
      </div>
      <button className="icon-btn" onClick={dismiss} aria-label="Fermer">×</button>
    </div>
  )
}
