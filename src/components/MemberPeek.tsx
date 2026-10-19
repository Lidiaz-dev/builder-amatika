import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { STAT_COLUMNS, type Faction } from '../data'
import { bagItems, effectiveStats, lootItems, memberName, memberSkills, profileOf, wornItems, type Member } from '../lib/crew'

const fmt = (v: number | null, dice: boolean) => (v === null ? '/' : dice ? `${v}+` : String(v))

/** Nom d'un membre : au survol (ou au toucher), sa fiche s'affiche dans une bulle. */
export default function MemberPeek({ faction, member, children }: { faction: Faction; member: Member; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchor.current || !card.current) return
    const a = anchor.current.getBoundingClientRect()
    const c = card.current.getBoundingClientRect()
    const left = Math.min(Math.max(8, a.left), window.innerWidth - c.width - 8)
    const below = a.bottom + 6
    setPos({ left, top: below + c.height > window.innerHeight - 8 ? Math.max(8, a.top - c.height - 6) : below })
  }, [open])

  const profile = profileOf(faction, member)
  const close = () => { setOpen(false); setPos(null) }
  if (!profile) return <>{children}</>
  const stats = effectiveStats(profile, member)
  const loot = lootItems(member)
  const worn = [...wornItems(member).map((e) => e.name), ...loot.filter((l) => l.ref.slot === 'porte').map((l) => l.item?.name ?? '?')]
  const bag = [...bagItems(member).map((e) => e.name), ...loot.filter((l) => l.ref.slot === 'sac').map((l) => l.item?.name ?? '?')]

  return (
    <span
      ref={anchor}
      className="member-peek"
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
      onFocus={() => setOpen(true)}
      onBlur={close}
    >
      {children}
      {open &&
        createPortal(
          <div ref={card} className="peek-card" role="tooltip" style={pos ?? { top: -9999, left: -9999 }}>
            <header className="unit-band">
              <h3>{memberName(member) || profile.name}</h3>
              <span className="unit-role">{profile.name} · niv. {member.level}</span>
            </header>
            <div className="peek-body">
              <table className="peek-stats">
                <thead><tr>{STAT_COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody><tr>{STAT_COLUMNS.map((c) => <td key={c.key}>{fmt(stats[c.key], c.dice)}</td>)}</tr></tbody>
              </table>
              <p><strong>Compétences :</strong> {memberSkills(profile, member).join(', ') || '—'}</p>
              <p><strong>Équipement porté :</strong> {worn.join(', ') || 'mains nues'}</p>
              {bag.length > 0 && <p><strong>Sac à dos :</strong> {bag.join(', ')}</p>}
              {(member.injuries?.length ?? 0) > 0 && <p><strong>Blessures :</strong> {member.injuries!.length}</p>}
              <p className="muted small">{member.xp} XP</p>
            </div>
          </div>,
          document.body,
        )}
    </span>
  )
}
