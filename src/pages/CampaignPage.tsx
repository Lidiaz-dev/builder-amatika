import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { factionById } from '../data'
import { useAuth } from '../lib/auth'
import {
  addPlayer,
  DAY_STATUS_LABELS,
  cancelDay,
  deleteCampaign,
  closeDay,
  createDay,
  getCampaign,
  getDay,
  getMyEntry,
  isAdmin,
  isOpen,
  launchDay,
  listDays,
  listEntries,
  listSheets,
  listUsers,
  removePlayer,
  startNight,
  type Day,
  type Entry,
  type GroupCampaign,
  type Sheet,
} from '../lib/groupCampaign'
import VerifyEmailNotice from '../components/VerifyEmailNotice'
import CampaignCrewPanel from '../components/CampaignCrewPanel'

export default function CampaignPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const admin = isAdmin(user)
  const me = (user?.email ?? '').toLowerCase()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState<GroupCampaign | null | undefined>(undefined)
  const [day, setDay] = useState<Day | null>(null)
  const [days, setDays] = useState<Day[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [myEntry, setMyEntry] = useState<Entry | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id || !user?.emailVerified) return
    setError('')
    try {
      const c = await getCampaign(id)
      if (!c) {
        setCampaign(null)
        return
      }
      // Tout est chargé avant d'être affiché : la bande du joueur ne doit jamais voir une journée « absente » par erreur.
      const current = await getDay(id, c.dayNumber)
      const [allDays, allEntries, allSheets, entry] = await Promise.all([
        listDays(id, c.dayNumber),
        admin ? listEntries(id) : Promise.resolve([] as Entry[]),
        admin && current && (current.status === 'nuit' || current.status === 'cloturee') ? listSheets(id, current.number) : Promise.resolve([] as Sheet[]),
        c.emails.includes(me) ? getMyEntry(id) : Promise.resolve(null),
      ])
      setDay(current)
      setDays(allDays)
      setEntries(allEntries)
      setSheets(allSheets)
      setMyEntry(entry)
      setCampaign(c)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [id, user, admin, me])

  useEffect(() => {
    load()
  }, [load])

  /** Exécute une action puis recharge la page, en affichant l'erreur éventuelle. */
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await action()
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!user?.emailVerified) {
    return (
      <section>
        <h1>Campagne</h1>
        <VerifyEmailNotice />
      </section>
    )
  }
  if (campaign === undefined) return <p className="muted">Chargement…</p>
  if (!campaign) {
    return (
      <section>
        <p className="error">Campagne introuvable, ou vous n'y êtes plus inscrit.</p>
        <Link to="/campagnes" className="btn">← Campagnes</Link>
      </section>
    )
  }

  const player = campaign.emails.includes(me)
  const dayOpen = !!day && isOpen(day.status)

  return (
    <section className="campaign-page">
      <nav className="crumbs">
        <Link to="/campagnes">Campagnes</Link> <span>›</span> {campaign.name}
      </nav>
      <div className="page-head">
        <h1>{campaign.name}</h1>
        <span className={`badge big ${dayOpen ? 'phase-badge phase-partie' : ''}`}>
          {day ? `Journée ${day.number} : ${DAY_STATUS_LABELS[day.status]}` : 'Aucune journée jouée'}
        </span>
      </div>
      {error && <p className="error">{error}</p>}

      {player && (
        <MyCrewPanel campaign={campaign} entry={myEntry} day={day} locked={dayOpen && !!day?.participants.includes(me)} onChanged={load} />
      )}

      {admin && (
        <>
          <DayPanel
            campaign={campaign}
            day={day}
            entries={entries}
            sheets={sheets}
            busy={busy}
            onCreate={() => run(() => createDay(campaign))}
            onLaunch={() => confirm(`Lancer la journée ${campaign.dayNumber} ? La préparation est verrouillée et les joueurs qui ne l'ont pas rejointe ne pourront plus le faire.`) && run(() => launchDay(campaign))}
            onNight={() => confirm(`Passer à la phase de nuit ? Chaque joueur fera sa récupération puis son rapport de fin de nuit.`) && run(() => startNight(campaign))}
            onClose={() => run(() => closeDay(campaign))}
            onCancel={() =>
              confirm(
                `Annuler la journée ${campaign.dayNumber} ? Elle est supprimée avec ses rapports et la campagne revient à la journée précédente.\n\nLes rapports déjà validés par les joueurs restent appliqués à leurs bandes.`,
              ) && run(() => cancelDay(campaign))
            }
          />
          <PlayersPanel
            entries={entries}
            busy={busy}
            onAdd={(email, pseudo) => run(() => addPlayer(campaign.id, email, pseudo))}
            onRemove={(email) =>
              confirm(`Retirer ${entries.find((x) => x.email === email)?.pseudo || email} de la campagne ? Sa bande n'est pas supprimée ; il pourra être réinscrit avec une nouvelle bande (reroll).`) &&
              run(() => removePlayer(campaign.id, email))
            }
          />
        </>
      )}

      <section className="card campaign-days">
        <h2>Journées</h2>
        {days.length === 0 && <p className="muted">Aucune journée pour le moment.</p>}
        <ul className="plain-list">
          {days.map((d) => (
            <li key={d.number}>
              <strong>Journée {d.number}</strong> · {DAY_STATUS_LABELS[d.status]} · {d.participants.length} bande{d.participants.length > 1 ? 's' : ''}
              {d.createdAt && <span className="muted small"> · créée le {new Date(d.createdAt).toLocaleDateString('fr-FR')}</span>}
              {player && d.participants.includes(me) && <span className="badge">Vous avez participé</span>}
            </li>
          ))}
        </ul>
      </section>

      {admin && (
        <p className="danger-zone">
          <button
            className="btn danger small"
            disabled={busy}
            onClick={() => confirm(`Annuler la campagne « ${campaign.name} » ? Elle est supprimée définitivement avec ses journées et ses rapports. Les bandes des joueurs restent dans leurs « Mes bandes ».`) && run(async () => { await deleteCampaign(campaign.id); navigate('/campagnes') })}
            data-tip="Supprime définitivement la campagne, ses journées et ses rapports."
          >
            Annuler la campagne
          </button>
        </p>
      )}
    </section>
  )
}

function MyCrewPanel({ campaign, entry, day, locked, onChanged }: {
  campaign: GroupCampaign
  entry: Entry | null
  day: Day | null
  locked: boolean
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const playing = !!day && !!entry && day.participants.includes(entry.email) && isOpen(day.status)
  const create = () => navigate(`/bandes/nouvelle?campagne=${campaign.id}`)

  return (
    <section className="card">
      <h2>Ma bande</h2>
      {entry?.crewId ? (
        <>
          <p>
            <Link to={`/bandes/${entry.crewId}`}><strong>{entry.crewName}</strong></Link>{' '}
            <span className="muted">({factionById(entry.factionId ?? '')?.name})</span>
            {playing && day && (
              <span className="badge phase-badge phase-partie">
                Journée {day.number} : {DAY_STATUS_LABELS[day.status].toLowerCase()}
              </span>
            )}
          </p>
          <CampaignCrewPanel campaign={campaign} crewId={entry.crewId} email={entry.email} day={day} onChanged={onChanged} />
          {locked ? (
            <p className="muted small">Votre bande a rejoint la journée en cours : pas de reroll avant sa clôture.</p>
          ) : (
            <button
              className="btn ghost small reroll-btn"
              onClick={() => confirm(`Reroll : créer une nouvelle bande pour la campagne ? « ${entry.crewName} » quittera la campagne mais restera dans « Mes bandes ».`) && create()}
            >
              Reroll : créer une nouvelle bande
            </button>
          )}
        </>
      ) : (
        <>
          <p className="muted">Vous n'avez pas encore de bande dans cette campagne.</p>
          <button className="btn primary" onClick={create}>+ Créer ma bande pour cette campagne</button>
        </>
      )}
    </section>
  )
}

/** Organisateur : pilotage de la journée (créer, lancer, nuit, clôturer, annuler). */
function DayPanel({ campaign, day, entries, sheets, busy, onCreate, onLaunch, onNight, onClose, onCancel }: {
  campaign: GroupCampaign
  day: Day | null
  entries: Entry[]
  sheets: Sheet[]
  busy: boolean
  onCreate: () => void
  onLaunch: () => void
  onNight: () => void
  onClose: () => void
  onCancel: () => void
}) {
  const entryOf = (email: string) => entries.find((e) => e.email === email)
  const who = (email: string) => entryOf(email)?.pseudo || email

  if (!day || !isOpen(day.status)) {
    const ready = entries.filter((e) => e.crewId && e.ready).length
    return (
      <section className="card">
        <h2>Journée {campaign.dayNumber + 1}</h2>
        <p className="muted small">
          {ready} bande{ready > 1 ? 's' : ''} prête{ready > 1 ? 's' : ''}. Une fois créée, chaque joueur pourra rejoindre la journée et préparer sa bande.
        </p>
        <button className="btn primary" onClick={onCreate} disabled={busy}>+ Créer la journée {campaign.dayNumber + 1}</button>
      </section>
    )
  }

  const report = (email: string) => sheets.find((s) => s.email === email)
  const allReports = day.participants.length > 0 && day.participants.every((e) => report(e))
  return (
    <section className="card">
      <h2>Journée {day.number} : {DAY_STATUS_LABELS[day.status]}</h2>
      {day.participants.length === 0 ? (
        <p className="muted">Aucune bande n'a encore rejoint la journée.</p>
      ) : (
        <ul className="plain-list day-sheets">
          {day.participants.map((email) => {
            const r = report(email)
            const e = entryOf(email)
            return (
              <li key={email}>
                <div className="row wrap">
                  <strong>{e?.crewName ?? '—'}</strong>
                  <span className="muted small" data-tip={email}>{who(email)}</span>
                  {day.status === 'nuit' && (r ? <span className="badge ok">✓ Rapport validé</span> : <span className="badge">Nuit en cours</span>)}
                  {e?.crewId && <Link className="link-btn small" to={`/bandes/${e.crewId}/fiches`}>Voir les fiches</Link>}
                </div>
                {r && r.lines.length > 0 && (
                  <details>
                    <summary className="small">Détail du rapport</summary>
                    <ul className="small">{r.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="row wrap">
        {day.status === 'preparation' && (
          <button className="btn primary" onClick={onLaunch} disabled={busy || !day.participants.length} data-tip={day.participants.length ? 'Verrouille la préparation : les parties commencent.' : 'Au moins une bande doit avoir rejoint la journée.'}>
            ⚔ Lancer la journée
          </button>
        )}
        {day.status === 'en-cours' && (
          <button className="btn primary" onClick={onNight} disabled={busy} data-tip="Les parties sont finies : chaque joueur fait sa récupération (poison, blessures, butin, cristaux, entretien) puis son rapport (XP, niveaux).">
            ☾ Phase de nuit
          </button>
        )}
        {day.status === 'nuit' && (
          <button className="btn primary" onClick={onClose} disabled={busy || !allReports} data-tip={allReports ? undefined : 'Tous les participants doivent avoir validé leur rapport de fin de nuit.'}>
            ✓ Clôturer la journée
          </button>
        )}
        <button className="btn ghost small danger" onClick={onCancel} disabled={busy} data-tip="Supprime cette journée et ses rapports ; la campagne revient à la journée précédente.">
          Annuler la journée
        </button>
      </div>
    </section>
  )
}

/** Organisateur : joueurs de la campagne. Ajout par email, par pseudo ou depuis la liste des inscrits. */
function PlayersPanel({ entries, busy, onAdd, onRemove }: {
  entries: Entry[]
  busy: boolean
  onAdd: (email: string, pseudo?: string) => void
  onRemove: (email: string) => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [users, setUsers] = useState<{ uid: string; pseudo: string; email: string }[] | null>(null)
  const [showList, setShowList] = useState(false)

  useEffect(() => {
    listUsers().then(setUsers).catch(() => setUsers([]))
  }, [])

  const inCampaign = (email: string) => entries.some((e) => e.email === email)
  const available = (users ?? []).filter((u) => !inCampaign(u.email))

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    setError('')
    const v = value.trim()
    if (!v) return
    if (v.includes('@')) {
      onAdd(v)
    } else {
      // Par pseudo : recherche parmi les comptes inscrits (sans tenir compte des majuscules).
      const found = (users ?? []).filter((u) => u.pseudo.toLowerCase() === v.toLowerCase())
      if (found.length === 0) return setError(`Aucun joueur inscrit avec le pseudo « ${v} ».`)
      if (found.length > 1) return setError(`Plusieurs joueurs ont le pseudo « ${v} » : utilisez la liste ou leur email.`)
      if (inCampaign(found[0].email)) return setError(`${found[0].pseudo} est déjà dans la campagne.`)
      onAdd(found[0].email, found[0].pseudo)
    }
    setValue('')
  }

  return (
    <section className="card">
      <h2>Joueurs ({entries.length})</h2>
      <ul className="plain-list">
        {entries.map((e) => (
          <li key={e.email} className="row wrap between">
            <span>
              <strong data-tip={e.email}>{e.pseudo || e.email}</strong>{' '}
              <span className="muted small">{e.crewName ? `${e.crewName} (${factionById(e.factionId ?? '')?.name})${e.ready ? '' : ' · en préparation'}` : 'pas encore de bande'}</span>
            </span>
            <button className="btn ghost small danger" onClick={() => onRemove(e.email)} disabled={busy}>Retirer</button>
          </li>
        ))}
      </ul>
      <form className="row wrap" onSubmit={submit}>
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setError('') }}
          placeholder="pseudo ou email du joueur"
          aria-label="Pseudo ou email du joueur à ajouter"
          list="known-players"
        />
        <datalist id="known-players">
          {available.map((u) => <option key={u.uid} value={u.pseudo} />)}
        </datalist>
        <button className="btn small" type="submit" disabled={!value.trim() || busy}>Ajouter le joueur</button>
        <button type="button" className="btn ghost small" onClick={() => setShowList((x) => !x)} aria-expanded={showList}>
          {showList ? 'Masquer' : 'Voir'} les joueurs inscrits ({available.length})
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {showList && (
        <ul className="plain-list known-players">
          {users === null && <li className="muted">Chargement…</li>}
          {users !== null && available.length === 0 && <li className="muted">Tous les joueurs inscrits sont déjà dans la campagne.</li>}
          {available.map((u) => (
            <li key={u.uid} className="row wrap between">
              <span><strong>{u.pseudo}</strong> <span className="muted small">{u.email}</span></span>
              <button className="btn small" disabled={busy} onClick={() => onAdd(u.email, u.pseudo)}>+ Ajouter</button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        Par email, le joueur voit la campagne dès qu'il se connecte avec cette adresse (il peut créer son compte après).
        Par pseudo ou depuis la liste : seulement les joueurs qui ont déjà un compte et un pseudo.
      </p>
    </section>
  )
}
