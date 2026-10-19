import { useState } from 'react'
import { profileOf, MAX_ON_TABLE, memberName, type Member } from '../lib/crew'
import type { Faction } from '../data'
import Modal from './Modal'

/** Lancer une partie : choix des participants (10 au maximum, blessés graves exclus). */
export default function LaunchModal({ open, faction, members, gameNumber, defaultTitle, onClose, onLaunch }: {
  open: boolean
  faction: Faction
  members: Member[]
  gameNumber: number
  /** Titre proposé (journée de campagne). */
  defaultTitle?: string
  onClose: () => void
  onLaunch: (title: string, participants: string[]) => void
}) {
  const eligible = members.filter((m) => !m.missNextGame)
  const [title, setTitle] = useState(defaultTitle ?? `Partie ${gameNumber}`)
  const [picked, setPicked] = useState<string[]>(eligible.slice(0, MAX_ON_TABLE).map((m) => m.id))
  return (
    <Modal
      open={open}
      title="Lancer la partie"
      kicker={`${picked.length} / ${MAX_ON_TABLE} figurines`}
      onClose={onClose}
      actions={<button className="btn primary small" disabled={!picked.length} onClick={() => onLaunch(title, picked)}>⚔ Commencer</button>}
    >
      <label className="field">
        <span>Nom de la partie</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <p className="muted small">Pendant la partie, les achats et le recrutement sont verrouillés. Tout ce que vous notez sera repris dans l'après-partie.</p>
      <ul className="check-list">
        {members.map((m) => {
          const on = picked.includes(m.id)
          const p = profileOf(faction, m)
          return (
            <li key={m.id}>
              <label>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={m.missNextGame || (!on && picked.length >= MAX_ON_TABLE)}
                  onChange={() => setPicked((ps) => (on ? ps.filter((x) => x !== m.id) : [...ps, m.id]))}
                />
                <strong>{memberName(m) || p?.name}</strong> <span className="muted small">{p?.name} · niv. {m.level}</span>
                {m.missNextGame && <span className="badge ko">Blessure grave : repos</span>}
              </label>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
