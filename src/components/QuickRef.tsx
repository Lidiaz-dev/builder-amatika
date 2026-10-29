import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import WoundTable from './WoundTable'
import { QUICK_REF, type QuickItem, type QuickPart } from '../lib/quickref'
import { downloadQuickRefPdf } from '../lib/quickrefPdf'

/** Aide-mémoire des règles : le contenu vient de lib/quickref (partagé avec le PDF). */
export default function QuickRef() {
  const [busy, setBusy] = useState(false)
  return (
    <section className="quickref">
      <div className="row between quickref-head">
        <h1>Aide-mémoire</h1>
        <button
          className="btn primary no-print"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await downloadQuickRefPdf()
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Création du PDF…' : '⬇ Télécharger le PDF'}
        </button>
      </div>
      <p className="muted no-print">L'essentiel des règles à garder sous les yeux pendant une partie. Le détail reste dans le <Link to="/regles/livre">livre de règles</Link>.</p>

      {QUICK_REF.map((section, n) => (
        <section key={section.title} className="qr-section">
          <h2 className="qr-section-title"><span>{n + 1}</span> {section.title}</h2>
          <div className="quickref-grid">
            {section.blocks.map((b) => (
              <section key={b.title} className={`card qr-block ${b.wide ? 'wide' : ''}`}>
                <h3>{b.title}</h3>
                {b.parts.map((part, i) => <Part key={i} part={part} />)}
              </section>
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}

function Part({ part }: { part: QuickPart }) {
  switch (part.kind) {
    case 'note':
      return <p className="qr-note"><Rich text={part.text} /></p>
    case 'list': {
      const Tag = part.ordered ? 'ol' : 'ul'
      return <Tag className={part.ordered ? 'qr-chain' : ''}>{part.items.map((it, i) => <Item key={i} item={it} />)}</Tag>
    }
    case 'grid':
      return (
        <table className="qr-table">
          {part.caption && <caption>{part.caption}</caption>}
          <tbody>
            {part.rows.map(([head, ...cells]) => (
              <tr key={head}><th>{head}</th>{cells.map((c, i) => <td key={i}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )
    case 'mods':
      return (
        <div className="qr-two">
          {part.tables.map((t) => (
            <table key={t.caption} className="qr-table qr-mods">
              <caption>{t.caption}</caption>
              <tbody>
                {t.rows.map(([v, label], i) => <tr key={i}><td>{v}</td><td>{label}</td></tr>)}
              </tbody>
            </table>
          ))}
        </div>
      )
    case 'defs':
      return <dl className="qr-actions">{part.rows.map(([dt, dd]) => [<dt key={`t${dt}`}>{dt}</dt>, <dd key={`d${dt}`}><Rich text={dd} /></dd>])}</dl>
    case 'wound':
      return <WoundTable />
  }
}

function Item({ item }: { item: QuickItem }) {
  if (typeof item === 'string') return <li><Rich text={item} /></li>
  return (
    <li>
      <Rich text={item.text} />
      <ul>{item.sub.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ul>
    </li>
  )
}

/** `**gras**` et `[texte](/chemin)`. */
function Rich({ text }: { text: string }) {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push(text.slice(last, m.index))
    out.push(m[1] ? <b key={m.index}>{m[1]}</b> : <Link key={m.index} to={m[3]}>{m[2]}</Link>)
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return <>{out}</>
}
