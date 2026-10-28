import { useEffect, useMemo, useRef, useState } from 'react'
import { creatures, injuries, itemByKey, spellById } from '../data'
import { DECKS, deckById, objectsToDraw, type Deck, type DeckCard } from '../lib/decks'
import { d10 } from '../lib/campaign'
import StatLine from '../components/StatLine'
import SkillTag from '../components/SkillTag'
import RarityDot from '../components/RarityDot'
import { SpellDetails } from '../components/SpellTag'
import ActivationBag, { type BagColor } from '../components/ActivationBag'
import RuleText from '../components/RuleText'
import DeploymentMap from '../components/DeploymentMap'
import WoundTable from '../components/WoundTable'

type Entry =
  | { id: string; at: string; type: 'card'; deckId: string; uid: string; returned?: boolean; /** Cartes tirées ensemble. */ batch?: string }
  | { id: string; at: string; type: 'dice'; label: string; detail: string }
  | { id: string; at: string; type: 'token'; name: string; color: string; left: number }

interface Session {
  /** Cartes encore dans chaque paquet (identifiants). */
  remaining: Record<string, string[]>
  history: Entry[]
  round: number
  /** Sac d'activation : couleurs des joueurs et jetons. */
  bag: BagColor[]
}

const STORAGE_KEY = 'amatika.assistant'
const freshDecks = () => Object.fromEntries(DECKS.map((d) => [d.id, d.cards.map((c) => c.uid)]))
const newSession = (bag: BagColor[] = []): Session => ({ remaining: freshDecks(), history: [], round: 1, bag })

function loadSession(): Session {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return newSession()
    const s = JSON.parse(raw) as Session
    // Paquet ajouté depuis : on le complète.
    for (const d of DECKS) if (!s.remaining[d.id]) s.remaining[d.id] = d.cards.map((c) => c.uid)
    s.bag ??= []
    return s
  } catch {
    return newSession()
  }
}

const uid = () => crypto.randomUUID()
const cardOf = (deck: Deck, cardUid: string) => deck.cards.find((c) => c.uid === cardUid)
const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const DIRECTIONS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
const injuryValue = (ref: string) => injuries.find((i) => i.id === ref)?.value

const TABS: { id: Deck['group']; label: string }[] = [
  { id: 'lieux', label: "Lieux d'intérêt" },
  { id: 'partie', label: 'Pendant la partie' },
  { id: 'apres', label: 'Après la partie' },
]
const TAB_KEY = 'amatika.assistant.tab'

function loadTab(): Deck['group'] {
  try {
    const t = localStorage.getItem(TAB_KEY)
    return TABS.some((x) => x.id === t) ? (t as Deck['group']) : 'partie'
  } catch {
    return 'partie'
  }
}

/** Assistant de partie : pioches réelles (une carte piochée quitte le paquet), dés et historique. */
export default function GameAssistantPage() {
  const [session, setSession] = useState<Session>(loadSession)
  const [shown, setShown] = useState<string | null>(null)
  const [tab, setTab] = useState<Deck['group']>(loadTab)
  /** Nombre de cartes tirées au prochain clic sur un paquet (haute létalité, Enchanteur…). */
  const [perDraw, setPerDraw] = useState(1)
  const drawnRef = useRef<HTMLDivElement>(null)

  // La carte tirée s'affiche au-dessus des paquets : on la ramène à l'écran si besoin (téléphone).
  useEffect(() => {
    const el = drawnRef.current
    if (!shown || !el) return
    const r = el.getBoundingClientRect()
    if (r.top < 60 || r.top > window.innerHeight - 120) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [shown])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      // Stockage indisponible : l'assistant marche quand même, sans sauvegarde.
    }
  }, [session])

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab)
    } catch {
      // ignoré
    }
  }, [tab])

  // Dernière version de la partie, mise à jour immédiatement : deux pioches rapprochées ne tirent jamais la même carte.
  const latest = useRef(session)
  latest.current = session
  const update = (fn: (s: Session) => Session) => {
    latest.current = fn(latest.current)
    setSession(latest.current)
  }
  const log = (s: Session, e: Entry): Session => ({ ...s, history: [e, ...s.history] })

  function draw(deckId: string, count = 1) {
    const batch = count > 1 ? uid() : undefined
    // Tirage fait ici (et non dans la mise à jour, que React peut rejouer) : chaque carte tirée sort du paquet.
    const pool = [...(latest.current.remaining[deckId] ?? [])]
    const entries: Entry[] = []
    for (let i = 0; i < count && pool.length; i++) {
      const [pick] = pool.splice(Math.floor(Math.random() * pool.length), 1)
      entries.push({ id: uid(), at: new Date().toISOString(), type: 'card', deckId, uid: pick, batch })
    }
    if (!entries.length) return
    const picked = new Set(entries.map((e) => (e.type === 'card' ? e.uid : '')))
    update((s) => ({
      ...s,
      remaining: { ...s.remaining, [deckId]: s.remaining[deckId].filter((u) => !picked.has(u)) },
      history: [...[...entries].reverse(), ...s.history],
    }))
    setShown(entries[entries.length - 1].id)
  }

  function drawToken() {
    // Tirage pondéré par le nombre de jetons de chaque couleur encore dans le sac.
    const bag = latest.current.bag
    const pool = bag.flatMap((c) => Array.from({ length: Math.max(0, c.total - c.drawn) }, () => c.id))
    if (!pool.length) return
    const pick = bag.find((c) => c.id === pool[Math.floor(Math.random() * pool.length)])
    if (!pick) return
    const e: Entry = { id: uid(), at: new Date().toISOString(), type: 'token', name: pick.name, color: pick.color, left: pool.length - 1 }
    update((s) => log({ ...s, bag: s.bag.map((c) => (c.id === pick.id ? { ...c, drawn: c.drawn + 1 } : c)) }, e))
    setShown(e.id)
  }

  const refilled = (bag: BagColor[]) => bag.map((c) => ({ ...c, drawn: 0 }))

  function refillBag() {
    update((s) => log({ ...s, bag: refilled(s.bag) }, { id: uid(), at: new Date().toISOString(), type: 'dice', label: 'Jetons remis dans le sac', detail: `${s.bag.reduce((n, c) => n + c.total, 0)} jetons` }))
  }

  function putBack(entryId: string) {
    update((s) => {
      const e = s.history.find((x) => x.id === entryId)
      if (!e || e.type !== 'card' || e.returned) return s
      return {
        ...s,
        remaining: { ...s.remaining, [e.deckId]: [...s.remaining[e.deckId], e.uid] },
        history: s.history.map((x) => (x.id === entryId ? { ...x, returned: true } : x)),
      }
    })
  }

  function reshuffle(deck: Deck) {
    const drawn = deck.cards.length - (session.remaining[deck.id]?.length ?? 0)
    if (drawn && !confirm(`Remettre les ${drawn} carte(s) piochée(s) dans le paquet ${deck.name} et le mélanger ?`)) return
    update((s) => log(
      { ...s, remaining: { ...s.remaining, [deck.id]: deck.cards.map((c) => c.uid) } },
      { id: uid(), at: new Date().toISOString(), type: 'dice', label: `${deck.name} remélangé`, detail: `${deck.cards.length} cartes` },
    ))
  }

  function roll(label: string, detail: string) {
    const e: Entry = { id: uid(), at: new Date().toISOString(), type: 'dice', label, detail }
    update((s) => log(s, e))
    setShown(e.id)
  }

  function endRound() {
    const r = session.round
    if (r < 4) {
      update((s) => log({ ...s, round: r + 1, bag: refilled(s.bag) }, { id: uid(), at: new Date().toISOString(), type: 'dice', label: `Fin du round ${r}`, detail: `La partie continue (le soleil ne peut se coucher qu'à partir du round 4). Jetons remis dans le sac.` }))
      return
    }
    const d = d10()
    const total = d + r * 2
    const sunset = total >= 18
    const e: Entry = {
      id: uid(), at: new Date().toISOString(), type: 'dice', label: `Fin du round ${r} : ${sunset ? 'le soleil se couche !' : 'la partie continue'}`,
      detail: `D10 = ${d}, + ${r} × 2 = ${total} (${sunset ? '18 ou plus : fin de la partie' : 'moins de 18'})`,
    }
    update((s) => log({ ...s, round: sunset ? r : r + 1, bag: refilled(s.bag) }, e))
    setShown(e.id)
  }

  function newGame() {
    if (!confirm("Commencer une nouvelle partie ? Tous les paquets sont remélangés, l’historique est effacé et le sac d’activation est vidé.")) return
    setSession(newSession())
    setShown(null)
  }

  const shownEntry = session.history.find((e) => e.id === shown) ?? null
  // Cartes tirées ensemble : on les montre côte à côte, dans l'ordre du tirage.
  const shownBatch =
    shownEntry?.type === 'card' && shownEntry.batch
      ? session.history.filter((e) => e.type === 'card' && e.batch === shownEntry.batch).reverse()
      : null
  const cardsDrawn = useMemo(() => session.history.filter((e) => e.type === 'card' && !e.returned).length, [session.history])

  return (
    <section className="assistant">
      <div className="page-head">
        <div>
          <h1>Assistant de partie</h1>
          <p className="muted">Piochez comme à la table : une carte piochée quitte son paquet jusqu'à ce que vous la remettiez.</p>
        </div>
        <button className="btn" onClick={newGame} data-tip="Remélange tous les paquets, efface l'historique et vide le sac d'activation.">↺ Nouvelle partie</button>
      </div>

      <div className="assistant-layout">
        <div className="assistant-main">
          <nav className="tabs assistant-tabs" role="tablist" aria-label="Moment de la partie">
            {TABS.map((t) => {
              const left = DECKS.filter((d) => d.group === t.id).reduce((n, d) => n + (session.remaining[d.id]?.length ?? 0), 0)
              return (
                <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                  {t.label} <span className="muted small">({left})</span>
                </button>
              )
            })}
          </nav>

          {tab === 'lieux' && (
            <details className="card deploy-card">
              <summary>⌖ Schéma de déploiement</summary>
              <DeploymentMap />
            </details>
          )}
          {tab === 'partie' && (
            <>
              <details className="card deploy-card">
                <summary>⚔ Tableau des blessures</summary>
                <WoundTable />
              </details>
              <section className="card dice-tray">
                <div className="round-box">
                  <span className="counter-label">Round</span>
                  <strong>{session.round}</strong>
                  <button className="btn small primary" onClick={endRound} data-tip="Remet les jetons dans le sac et fait le test du coucher de soleil (à partir du round 4).">Fin du round</button>
                </div>
                <div className="row wrap">
                  <button className="btn" onClick={() => roll('1D10', `${d10()}`)} data-tip="Lance un dé à 10 faces.">🎲 1D10</button>
                  <button className="btn" onClick={() => { const a = d10(); const b = d10(); roll('2D10', `${a} + ${b} = ${a + b}${a === b ? ' (double !)' : ''}`) }}>🎲 2D10</button>
                  <button className="btn" onClick={() => roll('Dispersion', `${DIRECTIONS[Math.floor(Math.random() * 8)]} sur ${d10()} cm`)} data-tip="Direction au hasard et distance (1D10 cm), pour disperser les cristaux bruts.">🧭 Dispersion</button>
                </div>
              </section>

              <ActivationBag colors={session.bag} onChange={(bag) => update((s) => ({ ...s, bag }))} onDraw={drawToken} onRefill={refillBag} />
            </>
          )}

          <div ref={drawnRef} className="drawn-anchor">
            {shownBatch && shownBatch.length > 1 ? (
              <DrawnBatch entries={shownBatch} onPutBack={putBack} onDraw={draw} onClose={() => setShown(null)} />
            ) : (
              shownEntry && <DrawnCard entry={shownEntry} onPutBack={putBack} onDraw={draw} onClose={() => setShown(null)} />
            )}
          </div>

          <section className="deck-group">
            <div className="per-draw" role="group" aria-label="Cartes par pioche">
              <span className="muted small">Cartes par pioche :</span>
              <div className="segmented">
                {[1, 2, 3].map((n) => (
                  <button key={n} className={perDraw === n ? 'on' : ''} onClick={() => setPerDraw(n)}>{n}</button>
                ))}
              </div>
              {perDraw > 1 && <span className="muted small">le prochain clic tire {perDraw} cartes du paquet</span>}
            </div>
            <div className="deck-grid">
              {DECKS.filter((d) => d.group === tab).map((d) => {
                const left = session.remaining[d.id]?.length ?? 0
                return (
                  <div key={d.id} className="deck-tile" style={{ ['--deck' as string]: d.color, ['--deck-ink' as string]: d.ink }}>
                    <button className="deck-back" onClick={() => { draw(d.id, perDraw); setPerDraw(1) }} disabled={!left} aria-label={`Piocher : ${d.name}`}>
                      <span className="deck-name">{d.name}</span>
                      <span className="deck-count">{left} / {d.cards.length}</span>
                      <span className="deck-action">{left ? (perDraw > 1 ? `Piocher ${Math.min(perDraw, left)}` : 'Piocher') : 'Vide'}</span>
                    </button>
                    <button className="link-btn small" onClick={() => reshuffle(d)} disabled={left === d.cards.length} data-tip="Remet toutes les cartes de ce paquet.">↺ Remélanger</button>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="card history-panel">
          <h2>Historique <span className="muted small">({cardsDrawn} carte{cardsDrawn > 1 ? 's' : ''} hors des paquets)</span></h2>
          {session.history.length === 0 && <p className="muted small">Rien pour l'instant. Piochez une carte ou lancez un dé.</p>}
          <ol className="history-list">
            {session.history.map((e) => {
              const deck = e.type === 'card' ? deckById(e.deckId) : undefined
              const card = deck && e.type === 'card' ? cardOf(deck, e.uid) : undefined
              return (
                <li key={e.id} className={`${e.type === 'card' && e.returned ? 'returned' : ''} ${shown === e.id ? 'on' : ''}`}>
                  <button className="history-item" onClick={() => setShown(e.id)}>
                    {e.type === 'token' ? (
                      <span className="history-chip token-chip" style={{ background: e.color }} />
                    ) : (
                      <span className="history-chip" style={deck ? { background: deck.color } : undefined}>{deck ? '' : '🎲'}</span>
                    )}
                    <span className="history-text">
                      <strong>
                        {e.type === 'card'
                          ? deck?.kind === 'location'
                            ? `${deck.name} : ${card?.text}`
                            : deck?.kind === 'injury' && card
                              ? `${card.title} (${injuryValue(card.ref)})`
                              : card?.title
                          : e.type === 'token' ? `Jeton : ${e.name}` : e.label}
                        {e.type === 'card' && e.batch ? <span className="batch-mark" title="Tirée avec d'autres cartes"> ⧉</span> : null}
                      </strong>
                      <span className="muted small">
                        {time(e.at)} · {e.type === 'card' ? deck?.name : e.type === 'token' ? `Sac d'activation · ${e.left} restant${e.left > 1 ? 's' : ''}` : e.detail}
                        {e.type === 'card' && e.returned ? ' · remise dans le paquet' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>
      </div>
    </section>
  )
}

function DrawnCard({ entry, onPutBack, onDraw, onClose }: {
  entry: Entry
  onPutBack: (id: string) => void
  onDraw: (deckId: string, count?: number) => void
  onClose: () => void
}) {
  if (entry.type === 'token') {
    return (
      <article className="drawn token-result" style={{ ['--deck' as string]: entry.color }}>
        <header><span>Sac d'activation</span><button className="icon-btn" onClick={onClose} aria-label="Fermer">×</button></header>
        <div className="token-big-row">
          <span className="token big" style={{ background: entry.color }} />
          <div>
            <p className="dice-big">{entry.name} active une figurine</p>
            <p className="muted small">{entry.left} jeton{entry.left > 1 ? 's' : ''} encore dans le sac.</p>
          </div>
        </div>
      </article>
    )
  }
  if (entry.type === 'dice') {
    return (
      <article className="drawn dice-result">
        <header><span>{entry.label}</span><button className="icon-btn" onClick={onClose} aria-label="Fermer">×</button></header>
        <p className="dice-big">{entry.detail}</p>
      </article>
    )
  }
  const deck = deckById(entry.deckId)!
  const card = cardOf(deck, entry.uid)!
  const objects = objectsToDraw(deck.kind === 'location' ? card.text : deck.kind === 'creature' ? creatures.find((c) => c.id === card.ref)?.gifts : undefined)
  return (
    <article className="drawn" style={{ ['--deck' as string]: deck.color, ['--deck-ink' as string]: deck.ink }}>
      <header>
        <span>{deck.name}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">×</button>
      </header>
      <div className="drawn-body">
        <CardContent deck={deck} card={card} />
      </div>
      <footer className="row wrap">
        {objects > 0 && (
          <button className="btn small primary" onClick={() => onDraw('objets', objects)}>
            Piocher {objects} objet{objects > 1 ? 's' : ''}
          </button>
        )}
        {entry.returned ? (
          <span className="muted small">Carte remise dans le paquet.</span>
        ) : (
          <button className="btn small" onClick={() => onPutBack(entry.id)}>Remettre dans le paquet</button>
        )}
      </footer>
    </article>
  )
}

function CardContent({ deck, card }: { deck: Deck; card: DeckCard }) {
  if (deck.kind === 'location') return <p className="drawn-text">{card.text}</p>
  if (deck.kind === 'injury') {
    const inj = injuries.find((i) => i.id === card.ref)
    return (
      <>
        <div className="injury-head">
          <h3>{card.title}</h3>
          <span className="injury-value" title="Valeur de la carte">{inj?.value}</span>
        </div>
        <p><RuleText text={inj?.description ?? ''} /></p>
      </>
    )
  }
  if (deck.kind === 'item') {
    const it = itemByKey(card.ref)
    return (
      <>
        <h3><RarityDot rarity={it?.rarity ?? 'blanc'} /> {it?.name}</h3>
        <p className="muted small">{it?.category}{it?.price !== null && it?.price !== undefined ? ` · ${it.price} PO` : ''}</p>
        <p><RuleText text={it?.description ?? ''} /></p>
      </>
    )
  }
  if (deck.kind === 'creature') {
    const cr = creatures.find((c) => c.id === card.ref)
    return (
      <>
        <h3>{cr?.name}</h3>
        {cr && <StatLine stats={cr.stats} />}
        {cr && cr.skills.length > 0 && <div className="tags">{cr.skills.map((s) => <SkillTag key={s} name={s} />)}</div>}
        {cr?.gifts && <p><strong>En la fouillant :</strong> {cr.gifts}</p>}
      </>
    )
  }
  const sp = spellById(card.ref)
  return (
    <>
      <h3>{sp?.name}</h3>
      {sp && <SpellDetails spell={sp} />}
    </>
  )
}

function DrawnBatch({ entries, onPutBack, onDraw, onClose }: {
  entries: Entry[]
  onPutBack: (id: string) => void
  onDraw: (deckId: string, count?: number) => void
  onClose: () => void
}) {
  const cards = entries.filter((e): e is Extract<Entry, { type: 'card' }> => e.type === 'card')
  const deck = deckById(cards[0].deckId)!
  const values = deck.kind === 'injury' ? cards.map((e) => injuryValue(cardOf(deck, e.uid)!.ref) ?? 0) : []
  const max = Math.max(...values)
  const min = Math.min(...values)
  const nameAt = (v: number) => cardOf(deck, cards[values.indexOf(v)].uid)?.title
  return (
    <article className="drawn batch" style={{ ['--deck' as string]: deck.color, ['--deck-ink' as string]: deck.ink }}>
      <header>
        <span>{deck.name} : {cards.length} cartes</span>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">×</button>
      </header>
      {deck.kind === 'injury' && max !== min && (
        <p className="batch-summary">
          <span>▲ Plus haute : <strong>{nameAt(max)} ({max})</strong>, à garder en haute létalité</span>
          <span>▼ Plus basse : <strong>{nameAt(min)} ({min})</strong>, à garder en faible létalité</span>
        </p>
      )}
      <div className="batch-grid">
        {cards.map((e, i) => {
          const card = cardOf(deck, e.uid)!
          const v = values[i]
          const objects = objectsToDraw(deck.kind === 'location' ? card.text : deck.kind === 'creature' ? creatures.find((c) => c.id === card.ref)?.gifts : undefined)
          return (
            <div key={e.id} className={`batch-card ${e.returned ? 'returned' : ''} ${deck.kind === 'injury' && max !== min ? (v === max ? 'high' : v === min ? 'low' : '') : ''}`}>
              <div className="drawn-body">
                <CardContent deck={deck} card={card} />
              </div>
              <footer className="row wrap">
                {objects > 0 && (
                  <button className="btn small primary" onClick={() => onDraw('objets', objects)}>Piocher {objects} objet{objects > 1 ? 's' : ''}</button>
                )}
                {e.returned ? (
                  <span className="muted small">Remise dans le paquet.</span>
                ) : (
                  <button className="btn small" onClick={() => onPutBack(e.id)}>Remettre</button>
                )}
              </footer>
            </div>
          )
        })}
      </div>
    </article>
  )
}
