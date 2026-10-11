import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { rules, skills } from '../data'

/**
 * Texte de règle mis en forme : libellés en gras, valeurs importantes (dés, modificateurs, distances,
 * tests…) soulignées, et renvois vers les autres règles (compétences, actions) consultables au survol.
 */

interface Entry {
  title: string
  kicker: string
  text: string
  /** Mot seul : il ne compte qu'écrit avec une majuscule (« Léger » oui, « un léger avantage » non). */
  capitalOnly: boolean
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Actions du tour de jeu : renvoyées seulement quand elles sont écrites comme leur titre. */
const ACTIONS = [
  'Se déplacer', 'Tirer', 'Charger', 'Attaquer au corps à corps', 'Fouiller', 'Ramasser', 'Viser', 'Recharger', 'Se Cacher',
  'Rester cacher', 'Se Révéler', 'Lancer un sort', 'Dissiper un sort', 'Canaliser', 'Se désengager', 'Utiliser un objet de son sac',
]

const GLOSSARY = new Map<string, Entry>()
function add(term: string, entry: Entry) {
  const key = norm(term)
  if (!GLOSSARY.has(key)) GLOSSARY.set(key, entry)
}
for (const s of skills) {
  const title = s.name.replace(/ (X|3)$/, '')
  const entry = { title: s.name, kicker: 'Compétence', text: s.description, capitalOnly: !title.includes(' ') }
  add(title, entry)
  if (title === 'Eclaireur') add('Éclaireur', entry)
}
for (const title of ACTIONS) {
  const section = rules.find((r) => r.title === title)
  if (section?.paragraphs.length) add(title, { title, kicker: 'Action', text: section.paragraphs.slice(0, 2).join('\n'), capitalOnly: true })
}
add('Faible Létalité', {
  title: 'Faible Létalité', kicker: 'Règle', capitalOnly: false,
  text: "La figurine blessée pioche 2 cartes Blessure et n'applique que celle ayant la valeur la plus basse.",
})
add('Haute Létalité', {
  title: 'Haute Létalité', kicker: 'Règle', capitalOnly: false,
  text: "La figurine blessée pioche 2 cartes Blessure et n'applique que celle ayant la valeur la plus haute.",
})

const B = '(?<![\\p{L}\\p{N}])'
const A = '(?![\\p{L}\\p{N}])'
const terms = [...new Set([...skills.map((s) => s.name.replace(/ (X|3)$/, '')), 'Éclaireur', ...ACTIONS, 'Faible Létalité', 'Haute Létalité'])]
  .sort((a, b) => b.length - a.length)
  .map(escape)

const PATTERN = new RegExp(
  [
    `(?<ref>${B}(?:${terms.join('|')})${A})`,
    `(?<test>${B}(?:tests?|jets?) (?:de |d'|d’|pour )[\\p{L}'’-]+)`,
    `(?<warn>${B}(?:obligatoirement|impossible|automatiquement|toujours|jamais|uniquement|ne peut pas|ne peuvent pas|ne peut plus)${A})`,
    `(?<key>${B}\\d*[dD](?:10|6|3)${A}|(?<![\\p{L}\\p{N}])[+\\-−]\\d+${A}|${B}\\d+\\+|${B}\\d+(?:,\\d+)? ?(?:ps|pas|pouces?|PO|cristal|cristaux|actions?)${A})`,
  ].join('|'),
  'giu',
)
const LABEL = /^([^:.\n]{2,60}?) ?: /
const MODIFIER = /^([+\-−]\d+) (\p{Lu}[^.:]{1,40}?) (?=(?:Si|La|Le|Les|Vous|Lorsque|Une?)\s)/u
const SENTENCE_START = /^(il|elle|ils|elles|si|pour|les|la|le|une?|des|ce|cette|lorsqu|quand|vous|on|en|au|dans)\b/i
const isLabel = (s: string) =>
  /^\p{Lu}/u.test(s) && !SENTENCE_START.test(s) && s.split(/\s+/).filter((w) => w !== '/').length <= 5

/** Surligne la recherche en cours. */
function hl(text: string, query?: string): ReactNode {
  if (!query) return text
  const n = norm(text)
  const q = norm(query)
  if (!q || !n.includes(q)) return text
  const parts: ReactNode[] = []
  let from = 0
  for (let i = n.indexOf(q); i !== -1; i = n.indexOf(q, i + q.length)) {
    parts.push(text.slice(from, i), <mark key={i}>{text.slice(i, i + q.length)}</mark>)
    from = i + q.length
  }
  parts.push(text.slice(from))
  return parts
}

interface Props {
  text: string
  /** Recherche à surligner. */
  query?: string
  /** Nom de la règle décrite : on ne renvoie pas vers elle-même. */
  self?: string
  /** Sans renvois (texte d'une infobulle). */
  noRefs?: boolean
}

export default function RuleText({ text, query, self, noRefs }: Props) {
  const seen = new Set<string>(self ? [norm(self.replace(/ (X|3)$/, ''))] : [])
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, li) => {
        const out: ReactNode[] = []
        let rest = line
        let offset = 0
        const label = LABEL.exec(line)
        // Libellé court en début de ligne (« Mouvement : », « Combat à mains nues : »), pas une phrase.
        if (label && isLabel(label[1])) {
          out.push(<strong key="label" className="rt-label">{hl(label[1], query)}</strong>, ' : ')
          rest = line.slice(label[0].length)
          offset = label[0].length
        } else {
          // Ligne de modificateur (« -1 Couvert Si… ») : le modificateur et son nom ressortent.
          const mod = MODIFIER.exec(line.trimStart())
          if (mod) {
            out.push(<strong key="mod" className="rt-key">{mod[1]}</strong>, ' ', <strong key="modname" className="rt-label">{hl(mod[2], query)}</strong>, ' ')
            offset = line.length - line.trimStart().length + mod[0].length
            rest = line.slice(offset)
          }
        }
        let last = 0
        for (const m of rest.matchAll(PATTERN)) {
          const g = m.groups ?? {}
          const at = m.index ?? 0
          const word = m[0]
          let node: ReactNode = null
          if (g.ref) {
            const key = norm(word)
            const entry = GLOSSARY.get(key)
            const lower = word[0] === word[0].toLowerCase()
            if (noRefs || !entry || seen.has(key) || (entry.capitalOnly && lower)) continue
            seen.add(key)
            node = <RefTip key={offset + at} label={hl(word, query)} entry={entry} />
          } else if (g.test) node = <span key={offset + at} className="rt-test">{hl(word, query)}</span>
          else if (g.warn) node = <em key={offset + at} className="rt-warn">{hl(word, query)}</em>
          else node = <strong key={offset + at} className="rt-key">{hl(word, query)}</strong>
          out.push(<span key={`t${at}`}>{hl(rest.slice(last, at), query)}</span>, node)
          last = at + word.length
        }
        out.push(<span key="end">{hl(rest.slice(last), query)}</span>)
        return (
          <span key={li}>
            {li > 0 && <br />}
            {out}
          </span>
        )
      })}
    </>
  )
}

/** Renvoi vers une autre règle : son texte s'affiche au survol (ou au toucher sur mobile). */
function RefTip({ label, entry }: { label: ReactNode; entry: Entry }) {
  const anchor = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchor.current || !pop.current) return
    const a = anchor.current.getBoundingClientRect()
    const p = pop.current.getBoundingClientRect()
    const left = Math.min(Math.max(8, a.left), window.innerWidth - p.width - 8)
    const below = a.bottom + 6
    const top = below + p.height > window.innerHeight - 8 ? Math.max(8, a.top - p.height - 6) : below
    setPos({ top, left })
  }, [open])

  // Dans une fenêtre modale, l'infobulle doit être rendue dans la modale pour passer au-dessus.
  const host = (open && anchor.current?.closest('dialog[open]')) || document.body
  return (
    <span
      ref={anchor}
      className="rt-ref"
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { setOpen(false); setPos(null) }}
      onFocus={() => setOpen(true)}
      onBlur={() => { setOpen(false); setPos(null) }}
      onClick={(e) => { e.stopPropagation(); setOpen(true) }}
    >
      {label}
      {open &&
        createPortal(
          <span
            ref={pop}
            className="rt-pop"
            role="tooltip"
            style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
          >
            <span className="rt-pop-kicker">{entry.kicker}</span>
            <strong className="rt-pop-title">{entry.title}</strong>
            <span className="rt-pop-text"><RuleText text={entry.text} noRefs /></span>
          </span>,
          host,
        )}
    </span>
  )
}
