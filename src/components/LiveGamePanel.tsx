import { useState } from 'react'
import { equipmentById, injuryById, itemByKey, type Faction } from '../data'
import {
  actionsOf,
  effectiveStats,
  emptyTally,
  isActive,
  lootItems,
  memberSkills,
  newId,
  profileOf,
  type Crew,
  type LiveGame,
  type LiveTally,
  type Member,
  memberName,
} from '../lib/crew'
import { applyInjury } from '../lib/campaign'
import StatLine from './StatLine'
import SkillTag from './SkillTag'
import InfoTag from './InfoTag'
import RarityDot from './RarityDot'
import EquipmentTag from './EquipmentTag'
import Modal from './Modal'
import InjuryPicker from './InjuryPicker'
import LootPicker, { type LootPick } from './LootPicker'

/** Modification de la bande calculée à partir de sa dernière version (évite d'écraser des clics rapprochés). */
export type CrewUpdater = (c: Crew) => Crew

interface Props {
  crew: Crew
  faction: Faction
  onChange: (update: CrewUpdater) => void
  /** Termine la partie : ouvre l'assistant d'après-partie. */
  onFinish: () => void
}

/** Vue « table de jeu » pendant une partie : seuls les participants, actions rapides et compteurs. */
export default function LiveGamePanel({ crew, faction, onChange, onFinish }: Props) {
  const game = crew.campaign!.currentGame!
  const [injuryFor, setInjuryFor] = useState<string | null>(null)
  const [lootFor, setLootFor] = useState<string | null>(null)

  /** Applique une modification à la partie (et éventuellement aux membres), à partir de la dernière version. */
  const mutate = (fn: (g: LiveGame, c: Crew) => { game?: Partial<LiveGame>; members?: Member[] }) =>
    onChange((c) => {
      const g = c.campaign!.currentGame!
      const out = fn(g, c)
      return { ...c, members: out.members ?? c.members, campaign: { ...c.campaign!, currentGame: { ...g, ...out.game } } }
    })
  const replaceIn = (members: Member[], m: Member) => members.map((x) => (x.id === m.id ? m : x))
  const nameOf = (m: Member) => memberName(m) || profileOf(faction, m)?.name || '?'
  const tallyOf = (g: LiveGame, id: string) => g.tallies[id] ?? emptyTally()
  const tally = (id: string) => tallyOf(game, id)
  const bump = (id: string, key: keyof LiveTally, delta: number) =>
    mutate((g) => ({ game: { tallies: { ...g.tallies, [id]: { ...tallyOf(g, id), [key]: Math.max(0, tallyOf(g, id)[key] + delta) } } } }))
  const toggleOut = (id: string) =>
    mutate((g) => ({ game: { outOfAction: g.outOfAction.includes(id) ? g.outOfAction.filter((x) => x !== id) : [...g.outOfAction, id] } }))

  const playing = game.participants.map((id) => crew.members.find((m) => m.id === id)).filter((m): m is Member => !!m)
  const benched = crew.members.filter((m) => isActive(m) && !game.participants.includes(m.id))
  const standing = playing.filter((m) => isActive(m) && !game.outOfAction.includes(m.id)).length

  function cancelGame() {
    if (!confirm("Annuler la partie ? Les compteurs et les objets utilisés sont remis à zéro. Les blessures et objets ramassés restent sur les figurines.")) return
    onChange((c) => ({
      ...c,
      members: c.members.map((m) => (m.loot?.some((l) => l.used) ? { ...m, loot: m.loot.map((l) => ({ ...l, used: false })) } : m)),
      campaign: { ...c.campaign!, currentGame: undefined },
    }))
  }

  return (
    <section className="live-game">
      <header className="live-banner">
        <div>
          <h2>⚔ {game.title}</h2>
          <p>{standing} / {playing.length} figurines debout · commencée le {new Date(game.startedAt).toLocaleDateString('fr-FR')}</p>
        </div>
        <div className="row wrap">
          <button className="btn primary" onClick={onFinish}>Terminer la partie</button>
          <button className="btn ghost small" onClick={cancelGame}>Annuler la partie</button>
        </div>
      </header>

      <div className="live-counters card">
        <Counter label="Cristaux bruts ramassés" value={game.rawCrystals} onDelta={(d) => mutate((g) => ({ game: { rawCrystals: Math.max(0, g.rawCrystals + d) } }))} big />
        <label className="field narrow">
          <span>PO trouvées</span>
          <input type="number" min={0} value={game.poFound || ''} placeholder="0" onChange={(e) => { const v = Number(e.target.value); mutate(() => ({ game: { poFound: v } })) }} />
        </label>
        <label className="field narrow">
          <span>Prestige gagné</span>
          <input type="number" min={0} value={game.prestige || ''} placeholder="0" onChange={(e) => { const v = Number(e.target.value); mutate(() => ({ game: { prestige: v } })) }} />
        </label>
      </div>

      <div className="live-grid">
        {playing.map((m) => {
          const p = profileOf(faction, m)
          if (!p) return null
          const dead = !isActive(m)
          const out = game.outOfAction.includes(m.id)
          const t = tally(m.id)
          const loot = lootItems(m)
          return (
            <article key={m.id} className={`unit-card live-card ${dead ? 'dead' : out ? 'out' : ''}`}>
              <header className="unit-band">
                <h3>{nameOf(m)}</h3>
                <span className="unit-role">{p.name} · niv. {m.level} · {actionsOf(m)} actions</span>
              </header>
              <div className="unit-body">
                <div className="live-status">
                  {dead ? (
                    <span className="badge ko">✝ Mort</span>
                  ) : (
                    <div className="segmented status-toggle" role="group" aria-label="État">
                      <button className={!out ? 'on' : ''} onClick={() => out && toggleOut(m.id)}>Debout</button>
                      <button className={out ? 'on ko' : ''} onClick={() => !out && toggleOut(m.id)}>Hors de combat</button>
                    </div>
                  )}
                  {(m.injuries ?? []).map((r) => (
                    <span key={r.id} className="badge ko">{injuryById(r.cardId)?.name}</span>
                  ))}
                </div>
                <StatLine stats={effectiveStats(p, m)} base={p.stats} />
                <div className="tags">{memberSkills(p, m).map((s) => <SkillTag key={s} name={s} />)}</div>

                {(m.equipment.length > 0 || loot.length > 0) && (
                  <ul className="live-items">
                    {m.equipment.map((ref, i) => {
                      const e = equipmentById(ref.itemId)
                      return e ? <li key={`e${i}`}><RarityDot rarity="blanc" /> <EquipmentTag item={e} />{ref.slot === 'sac' && <span className="muted small"> (sac)</span>}</li> : null
                    })}
                    {loot.map(({ ref, item }) => (
                      <li key={ref.id} className={ref.used ? 'used' : undefined}>
                        <RarityDot rarity={item?.rarity ?? 'blanc'} />{' '}
                        <InfoTag label={item?.name ?? ref.key} kicker={item?.category} className="loot-tag"><p>{item?.description}</p></InfoTag>
                        {ref.slot === 'sac' && <span className="muted small"> (sac)</span>}
                        {item?.consumable && !dead && (
                          <button
                            className={`btn small ${ref.used ? 'used-btn' : ''}`}
                            onClick={() => onChange((c) => ({
                              ...c,
                              members: c.members.map((x) => (x.id === m.id ? { ...x, loot: (x.loot ?? []).map((l) => (l.id === ref.id ? { ...l, used: !l.used } : l)) } : x)),
                            }))}
                          >
                            {ref.used ? '✓ Utilisé' : 'Utiliser'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {!dead && (
                  <div className="live-tallies">
                    <Counter label="XP de PV retirés" value={t.damageXp} onDelta={(d) => bump(m.id, 'damageXp', d)} steps={[2, 5]} />
                    <Counter label="Ennemis tués" value={t.kills} onDelta={(d) => bump(m.id, 'kills', d)} />
                    <Counter label="Lieux fouillés" value={t.places} onDelta={(d) => bump(m.id, 'places', d)} />
                  </div>
                )}
              </div>
              {!dead && (
                <footer className="unit-actions">
                  <button className="btn small" onClick={() => setInjuryFor(m.id)}>✚ Blessure</button>
                  <button className="btn small" onClick={() => setLootFor(m.id)}>⚱ Objet ramassé</button>
                </footer>
              )}
            </article>
          )
        })}
      </div>

      {benched.length > 0 && (
        <p className="muted small">Restés au camp : {benched.map(nameOf).join(', ')}.</p>
      )}

      <Modal open={!!injuryFor} title={`Blessure : ${injuryFor ? nameOf(crew.members.find((m) => m.id === injuryFor)!) : ''}`} kicker="Paquet Blessure" onClose={() => setInjuryFor(null)}>
        {injuryFor && (
          <InjuryPicker
            onApply={(card) => {
              const id = injuryFor
              const knocked = card.kind !== 'meme-pas-mal' && !card.special
              mutate((g, c) => {
                const m = c.members.find((x) => x.id === id)!
                const res = applyInjury(m, card)
                return {
                  members: replaceIn(c.members, res.member),
                  game: {
                    outOfAction: knocked && !g.outOfAction.includes(id) ? [...g.outOfAction, id] : g.outOfAction,
                    events: [...g.events, { step: 'injuries', text: `${nameOf(m)} : ${card.name}${res.messages.length && card.lasting ? ` (${res.messages.join(' ')})` : ''}` }],
                  },
                }
              })
              if (!card.special) setInjuryFor(null)
            }}
            onNegotiate={() => {
              const id = injuryFor
              onChange((c) => {
                const m = c.members.find((x) => x.id === id)!
                const g = c.campaign!.currentGame!
                return {
                  ...c,
                  campaign: {
                    ...c.campaign!,
                    po: c.campaign!.po - 20,
                    log: [...c.campaign!.log, { date: new Date().toISOString(), label: `${g.title} : négociation avec la mort (${nameOf(m)})`, po: -20 }],
                    currentGame: { ...g, events: [...g.events, { step: 'injuries', text: `${nameOf(m)} : négociation avec la mort, 20 PO payés` }] },
                  },
                }
              })
              setInjuryFor(null)
            }}
          />
        )}
      </Modal>
      <Modal open={!!lootFor} title={`Objet ramassé : ${lootFor ? nameOf(crew.members.find((m) => m.id === lootFor)!) : ''}`} onClose={() => setLootFor(null)}>
        {lootFor && (
          <LootPicker
            allowedEquipment={null}
            foundOnly
            onPick={(pick: LootPick) => {
              const id = lootFor
              const name = pick.kind === 'loot' ? itemByKey(pick.key)?.name : equipmentById(pick.itemId)?.name
              mutate((g, c) => {
                const m = c.members.find((x) => x.id === id)!
                const next =
                  pick.kind === 'loot'
                    ? { ...m, loot: [...(m.loot ?? []), { id: newId(), key: pick.key, slot: 'sac' as const }] }
                    : { ...m, equipment: [...m.equipment, { itemId: pick.itemId, slot: 'sac' as const }] }
                return { members: replaceIn(c.members, next), game: { events: [...g.events, { step: 'loot', text: `${nameOf(m)} ramasse : ${name}` }] } }
              })
              setLootFor(null)
            }}
          />
        )}
      </Modal>
    </section>
  )
}

function Counter({ label, value, onDelta, steps = [1], big }: { label: string; value: number; onDelta: (d: number) => void; steps?: number[]; big?: boolean }) {
  return (
    <div className={`counter ${big ? 'big' : ''}`}>
      <span className="counter-label">{label}</span>
      <div className="counter-controls">
        <button type="button" className="btn small" onClick={() => onDelta(-Math.min(value, steps[0]))} aria-label={`${label} : moins`} disabled={value <= 0}>−</button>
        <strong>{value}</strong>
        {steps.map((s) => (
          <button key={s} type="button" className="btn small" onClick={() => onDelta(s)} aria-label={`${label} : plus ${s}`}>+{s === 1 ? '' : s}</button>
        ))}
      </div>
    </div>
  )
}
