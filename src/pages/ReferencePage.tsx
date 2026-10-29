import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom'
import {
  CATEGORY_LABELS,
  equipment,
  factionById,
  factions,
  itemCategories,
  itemKey,
  racialFactionsOf,
  racialItemsOf,
  lore,
  rules,
  skills,
  spells,
  TREE_LABELS,
  RARITIES,
  RARITY_LABELS,
  type EquipmentCategory,
  type Rarity,
  type Role,
} from '../data'
import DeploymentMap from '../components/DeploymentMap'
import WoundTable from '../components/WoundTable'
import QuickRef from '../components/QuickRef'
import ProfileCard from '../components/ProfileCard'
import FactionSeal from '../components/FactionSeal'
import SpellTag, { SpellDetails } from '../components/SpellTag'
import RarityDot from '../components/RarityDot'
import { formatMods } from '../lib/format'
import RuleText from '../components/RuleText'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const CATEGORIES = (Object.keys(CATEGORY_LABELS) as EquipmentCategory[]).sort((a, b) => CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b], 'fr'))
const TREES = [...new Set(skills.map((s) => s.tree))].sort((a, b) => (TREE_LABELS[a] ?? a).localeCompare(TREE_LABELS[b] ?? b, 'fr'))
const SPELL_TYPES = [...new Set(spells.map((s) => s.type))].sort((a, b) => a.localeCompare(b, 'fr'))

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const n = norm(text)
  const q = norm(query)
  const parts: ReactNode[] = []
  let from = 0
  for (let i = n.indexOf(q); i !== -1; i = n.indexOf(q, i + q.length)) {
    parts.push(text.slice(from, i), <mark key={i}>{text.slice(i, i + q.length)}</mark>)
    from = i + q.length
  }
  parts.push(text.slice(from))
  return <>{parts}</>
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
const slugify = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-')

const SECTIONS = [
  { path: 'aide-memoire', title: 'Aide-mémoire', text: 'Les règles à garder sous les yeux en partie : round, actions, combat, créatures.', glyph: '☰' },
  { path: 'histoire', title: 'Histoire', text: "L'île d'Amatika et la ruée vers les cristaux.", glyph: '☙' },
  { path: 'livre', title: 'Livre de règles', text: 'Les règles du jeu, de la mise en place à la campagne.', glyph: '❦' },
  { path: 'bandes', title: 'Bandes', text: 'Toutes les factions et leurs profils.', glyph: '⚔' },
  { path: 'competences', title: 'Compétences', text: 'Les compétences, par arbre.', glyph: '✦' },
  { path: 'sorts', title: 'Sorts', text: 'Les sorts communs et raciaux.', glyph: '✧' },
  { path: 'objets', title: 'Équipement et objets', text: 'Équipement commun, trésors et marché noir.', glyph: '⚒' },
  { path: 'deploiement', title: 'Déploiement', text: "Points de déploiement de 3 à 8 joueurs selon la table, et arrivée des démons.", glyph: '⌖' },
]

export default function ReferencePage() {
  const [query, setQuery] = useState('')
  const { pathname } = useLocation()
  const section = SECTIONS.find((s) => pathname.startsWith(`/regles/${s.path}`))
  const factionId = pathname.match(/^\/regles\/bandes\/([^/]+)/)?.[1]
  const faction = factionId ? factionById(factionId) : undefined

  return (
    <div className="compendium">
      <aside className="compendium-nav no-print">
        <NavLink to="/regles" end className="nav-head">Compendium</NavLink>
        <input className="search" type="search" placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <NavLink to="/regles/aide-memoire" className="nav-single">Aide-mémoire</NavLink>
        <NavLink to="/regles/histoire" className="nav-single">Histoire</NavLink>
        <details open={section?.path === 'livre'}>
          <summary><NavLink to="/regles/livre">Livre de règles</NavLink></summary>
          {rules.filter((r) => r.level === 2).map((r) => (
            <Link key={r.id} to="/regles/livre" onClick={() => setTimeout(() => scrollTo(`r-${r.id}`), 50)}>{r.title}</Link>
          ))}
        </details>
        <details open={section?.path === 'bandes'}>
          <summary><NavLink to="/regles/bandes" end>Bandes</NavLink></summary>
          {factions.map((f) => <NavLink key={f.id} to={`/regles/bandes/${f.id}`}>{f.name}</NavLink>)}
        </details>
        <details open={section?.path === 'competences'}>
          <summary><NavLink to="/regles/competences">Compétences</NavLink></summary>
          {TREES.map((t) => (
            <Link key={t} to="/regles/competences" onClick={() => setTimeout(() => scrollTo(`t-${t}`), 50)}>{TREE_LABELS[t] ?? t}</Link>
          ))}
        </details>
        <details open={section?.path === 'sorts'}>
          <summary><NavLink to="/regles/sorts">Sorts</NavLink></summary>
          {SPELL_TYPES.map((t) => (
            <Link key={t} to="/regles/sorts" onClick={() => setTimeout(() => scrollTo(`s-${slugify(t)}`), 50)}>{t}</Link>
          ))}
        </details>
        <details open={section?.path === 'objets'}>
          <summary><NavLink to="/regles/objets">Équipement et objets</NavLink></summary>
          <span className="nav-group">Équipement commun</span>
          {CATEGORIES.map((c) => (
            <Link key={c} to="/regles/objets" onClick={() => setTimeout(() => scrollTo(`e-${c}`), 50)}>{CATEGORY_LABELS[c]}</Link>
          ))}
          <span className="nav-group">Trésors et marché noir</span>
          {itemCategories.filter((c) => c.items.length).map((c) => (
            <Link key={c.id} to="/regles/objets" onClick={() => setTimeout(() => scrollTo(`o-${c.id}`), 50)}>{c.name}</Link>
          ))}
        </details>
        <NavLink to="/regles/deploiement" className="nav-single">Déploiement</NavLink>
      </aside>

      <div className="compendium-main">
        <nav className="crumbs">
          <Link to="/regles">Compendium</Link>
          {section && <><span>›</span><Link to={`/regles/${section.path}`}>{section.title}</Link></>}
          {faction && <><span>›</span>{faction.name}</>}
        </nav>
        <Routes>
          <Route index element={<Landing />} />
          <Route path="aide-memoire" element={<QuickRef />} />
          <Route path="histoire" element={<Lore query={query} />} />
          <Route path="livre" element={<RulesBook query={query} />} />
          <Route path="sorts" element={<SpellsRef query={query} />} />
          <Route path="objets" element={<ItemsRef query={query} />} />
          <Route path="competences" element={<SkillsRef query={query} />} />
          <Route path="equipement" element={<Navigate to="/regles/objets" replace />} />
          <Route path="deploiement" element={<section><h1>Déploiement</h1><DeploymentMap /></section>} />
          <Route path="bandes" element={<FactionsIndex query={query} />} />
          <Route path="bandes/:factionId" element={<FactionPage query={query} />} />
        </Routes>
      </div>
    </div>
  )
}

function Landing() {
  return (
    <section>
      <h1>Compendium</h1>
      <p className="lead">Toutes les règles d'Amatika : le livre de règles, les bandes, les compétences et l'équipement.</p>
      <div className="tile-grid compact">
        {SECTIONS.map((s) => (
          <Link key={s.path} to={`/regles/${s.path}`} className="tile">
            <span className="tile-glyph">{s.glyph}</span>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function RulesBook({ query }: { query: string }) {
  const sections = useMemo(() => {
    if (!query) return rules
    const q = norm(query)
    return rules
      .map((s) => ({ ...s, paragraphs: norm(s.title).includes(q) ? s.paragraphs : s.paragraphs.filter((p) => norm(p).includes(q)) }))
      .filter((s) => s.paragraphs.length > 0 || norm(s.title).includes(q))
  }, [query])

  return (
    <article className="rules-text">
      <h1>Livre de règles</h1>
      {sections.length === 0 && <p className="muted">Aucun résultat.</p>}
      {sections.map((s) => {
        const Tag = s.level === 2 ? 'h2' : 'h3'
        return (
          <section key={s.id + s.title} id={`r-${s.id}`}>
            <Tag><Highlight text={s.title} query={query} /></Tag>
            {s.paragraphs.map((p, i) => (
              <Fragment key={i}>
                <p><RuleText text={p} query={query} /></p>
                {/* Le livre annonce le tableau des blessures sans le donner : on l'affiche juste après. */}
                {p.startsWith('Le tableau ci-dessous indique le résultat requis sur un D10 pour infliger une blessure') && <WoundTable />}
              </Fragment>
            ))}
          </section>
        )
      })}
    </article>
  )
}

function SkillsRef({ query }: { query: string }) {
  const q = norm(query)
  return (
    <section>
      <h1>Compétences</h1>
      <div className="stack">
        {TREES.map((tree) => {
          const list = skills.filter((s) => s.tree === tree && (!q || norm(s.name + ' ' + s.description).includes(q)))
          if (!list.length) return null
          return (
            <section key={tree} id={`t-${tree}`} className="unit-card">
              <header className="unit-band"><h3>{TREE_LABELS[tree] ?? tree}</h3></header>
              <dl className="defs unit-body">
                {list.map((s) => (
                  <div key={s.id}>
                    <dt><Highlight text={s.name} query={query} /></dt>
                    <dd><RuleText text={s.description} query={query} self={s.name} /></dd>
                  </div>
                ))}
              </dl>
            </section>
          )
        })}
      </div>
    </section>
  )
}

/** Équipement commun (armes, armures…), achetable à la création comme en campagne. */
function EquipmentTables({ query }: { query: string }) {
  const q = norm(query)
  return (
    <>
      <div className="stack">
        {CATEGORIES.map((cat) => {
          const list = equipment.filter((e) => e.category === cat && (!q || norm(e.name + ' ' + e.rules).includes(q)))
          if (!list.length) return null
          const weapon = cat === 'melee' || cat === 'ranged'
          return (
            <section key={cat} id={`e-${cat}`} className="unit-card">
              <header className="unit-band"><h3>{CATEGORY_LABELS[cat]}</h3></header>
              <div className="table-wrap">
                <table className="ref-table">
                  <thead>
                    <tr>
                      <th>Nom</th><th>Prix</th><th>Mains</th>
                      <th>{weapon ? 'Force' : 'Svg'}</th>
                      {cat === 'ranged' && <th>Portée</th>}
                      <th>Règles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => (
                      <tr key={e.id}>
                        <td><RarityDot rarity="blanc" /> <strong><Highlight text={e.name} query={query} /></strong></td>
                        <td className="nowrap">{e.price} PO</td>
                        <td>{e.hands || '—'}</td>
                        <td>{e.strength ?? (e.save ? `+${e.save}` : '—')}</td>
                        {cat === 'ranged' && <td>{e.range} ps</td>}
                        <td><RuleText text={e.rules} query={query} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

function FactionsIndex({ query }: { query: string }) {
  const q = norm(query)
  const list = factions.filter((f) => !q || norm(f.name + ' ' + f.profiles.map((p) => p.name).join(' ')).includes(q))
  return (
    <section>
      <h1>Bandes</h1>
      <div className="faction-list">
        {list.map((f) => (
          <Link key={f.id} to={`/regles/bandes/${f.id}`} className="faction-row">
            <FactionSeal id={f.id} name={f.name} size={52} />
            <span className="faction-row-text">
              <strong>{f.name}</strong>
              <span className="muted small">{f.profiles.map((p) => p.name).join(', ')}</span>
            </span>
            <span className="chevron" aria-hidden="true">›</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

const ROLE_GROUPS: { role: Role; title: string }[] = [
  { role: 'chef', title: 'Chef' },
  { role: 'specialiste', title: 'Spécialistes' },
  { role: 'recrue', title: 'Recrues' },
  { role: 'monstre', title: 'Monstres' },
]

function FactionPage({ query }: { query: string }) {
  const { factionId } = useParams()
  const faction = factionById(factionId!)
  if (!faction) return <p className="error">Faction inconnue.</p>
  const q = norm(query)
  const racialSpells = spells.filter((sp) => sp.factions.includes(faction.id))
  return (
    <section>
      <header className="faction-hero">
        <FactionSeal id={faction.id} name={faction.name} size={72} />
        <h1>{faction.name}</h1>
      </header>
      {faction.notes.map((n, i) => <p key={i} className="notice">{n}</p>)}
      {racialItemsOf(faction.id).map((it) => (
        <p key={it.key} className="notice">
          <strong>Objet racial :</strong> {it.name} ({it.price ?? '—'} PO), achetable dès la création de la bande
          {it.requires ? ` par les modèles ayant accès à : ${equipment.find((e) => e.id === it.requires)?.name ?? it.requires}` : ''}. <span className="muted">{it.description}</span>
        </p>
      ))}
      {ROLE_GROUPS.map(({ role, title }) => {
        const list = faction.profiles.filter((p) => p.role === role && (!q || norm(p.name + ' ' + p.skills.join(' ')).includes(q)))
        if (!list.length) return null
        return (
          <section key={role} className="role-group">
            <h2>{title}</h2>
            <div className="unit-grid">
              {list.map((p) => <ProfileCard key={p.id} profile={p} />)}
            </div>
          </section>
        )
      })}
      {racialSpells.length > 0 && (
        <section className="role-group">
          <h2>Sorts raciaux</h2>
          <div className="tags">{racialSpells.map((sp) => <SpellTag key={sp.id} spell={sp} />)}</div>
        </section>
      )}
      <Link to={`/bandes/nouvelle`} className="btn primary">Créer une bande</Link>
    </section>
  )
}

function Lore({ query }: { query: string }) {
  const q = norm(query)
  const paragraphs = q ? lore.paragraphs.filter((p) => norm(p).includes(q)) : lore.paragraphs
  return (
    <article className="rules-text lore">
      <h1>{lore.title}</h1>
      {paragraphs.map((p, i) => <p key={i}><Highlight text={p} query={query} /></p>)}
      {paragraphs.length === 0 && <p className="muted">Aucun résultat.</p>}
    </article>
  )
}

function SpellsRef({ query }: { query: string }) {
  const q = norm(query)
  return (
    <section>
      <h1>Sorts</h1>
      <p className="lead">
        Un mage connaît l'Orbe mineur et le sort racial de sa faction dès son recrutement. À chaque niveau, il pioche 5 sorts et en
        apprend un. Pour lancer un sort, il faut obtenir sur 2D10 au moins sa valeur de lancement.
      </p>
      <div className="stack">
        {SPELL_TYPES.map((type) => {
          const list = spells.filter(
            (sp) => sp.type === type && (!q || norm(`${sp.name} ${sp.description} ${sp.racial ?? ''} ${sp.summonSkills ?? ''}`).includes(q)),
          )
          if (!list.length) return null
          return (
            <section key={type} id={`s-${slugify(type)}`} className="unit-card">
              <header className="unit-band"><h3>{type}</h3><span className="unit-role">{list.length} sorts</span></header>
              <dl className="defs unit-body">
                {list.map((sp) => (
                  <div key={sp.id}>
                    <dt><Highlight text={sp.name} query={query} /></dt>
                    <dd><SpellDetails spell={sp} /></dd>
                  </div>
                ))}
              </dl>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function ItemsRef({ query }: { query: string }) {
  const q = norm(query)
  const [rarity, setRarity] = useState<Rarity | ''>('')
  return (
    <section>
      <h1>Équipement et objets</h1>
      <p className="lead">L'équipement commun s'achète à la création de la bande et entre les parties. Les autres objets se trouvent dans les trésors ou s'achètent au marché noir. Tout se revend à moitié prix.</p>
      <div className="filter-bar rarity-filter" role="group" aria-label="Filtrer par rareté">
        <button className={`chip ${rarity === '' ? 'on' : ''}`} onClick={() => setRarity('')}>Toutes</button>
        {RARITIES.map((r) => (
          <button key={r} className={`chip ${rarity === r ? 'on' : ''}`} onClick={() => setRarity(rarity === r ? '' : r)}>
            <RarityDot rarity={r} /> {RARITY_LABELS[r]}
          </button>
        ))}
      </div>
      {(!rarity || rarity === 'blanc') && (
        <>
          <h2 className="ref-part">Équipement commun</h2>
          <EquipmentTables query={query} />
        </>
      )}
      <h2 className="ref-part">Trésors et marché noir</h2>
      <div className="stack">
        {itemCategories.map((cat) => {
          const list = cat.items
            .filter((it) => (!rarity || it.rarity === rarity) && (!q || norm(`${it.name} ${it.description}`).includes(q)))
          if (!list.length) return null
          return (
            <section key={cat.id} id={`o-${cat.id}`} className="unit-card">
              <header className="unit-band"><h3>{cat.name}</h3><span className="unit-role">{list.length}</span></header>
              <div className="table-wrap">
                <table className="ref-table">
                  <tbody>
                    {list.map((it) => (
                      <tr key={it.id}>
                        <td className="nowrap"><RarityDot rarity={it.rarity} /> <strong><Highlight text={it.name} query={query} /></strong></td>
                        <td>
                          <RuleText text={it.description} query={query} />
                          {(it.mods || it.skills) && (
                            <span className="fx"> Fiche : {[formatMods(it.mods), ...(it.skills ?? [])].filter(Boolean).join(', ')}</span>
                          )}
                          {racialFactionsOf(itemKey(cat.id, it.id)).map((f) => (
                            <span key={f} className="badge racial-badge" title="Achetable par cette faction dès la création de la bande">Objet racial : {f}</span>
                          ))}
                        </td>
                        <td className="nowrap">{it.price !== null ? `${it.price} PO` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
