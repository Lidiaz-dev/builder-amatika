import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { factionById, injuryById, skillByName, spellById, TREE_LABELS } from '../data'
import {
  actionsOf,
  bagItems,
  crewCost,
  crewItemsReminder,
  crewUpkeep,
  effectiveStats,
  isActive,
  lootItems,
  memberCost,
  memberSkills,
  memberUpkeep,
  profileOf,
  wornItems,
  type Crew,
  memberName,
} from '../lib/crew'
import { getCrew } from '../lib/storage'
import StatLine from '../components/StatLine'
import { downloadSheetsPdf } from '../lib/pdf'

export default function CrewSheetsPage() {
  const { id } = useParams()
  const [crew, setCrew] = useState<Crew | null | undefined>(undefined)
  const [withRules, setWithRules] = useState(true)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    getCrew(id!).then(setCrew).catch(() => setCrew(null))
  }, [id])

  if (crew === undefined) return <p className="muted">Chargement…</p>
  const faction = crew ? factionById(crew.factionId) : undefined
  if (!crew || !faction) return <p className="error">Bande introuvable.</p>

  const upkeep = crewUpkeep(crew)
  const members = crew.members.filter(isActive)
  // Lignes communes à toutes les fiches (sac à dos, sorts) : affichées partout dès qu'un membre en a.
  const anyBag = members.some((m) => bagItems(m).length > 0 || lootItems(m).some((l) => l.ref.slot === 'sac'))
  const anySpells = members.some((m) => (m.spellIds?.length ?? 0) > 0 || !!m.spells)
  const sheetRows = 3 + (anyBag ? 1 : 0) + (anySpells ? 1 : 0)
  const usedSkills = [...new Set(members.flatMap((m) => {
    const p = profileOf(faction, m)
    return p ? memberSkills(p, m) : []
  }))].sort((a, b) => a.localeCompare(b, 'fr'))
  const carried = crewItemsReminder(crew)

  return (
    <section className="sheets">
      <div className="row between no-print sheets-toolbar">
        <Link to={`/bandes/${crew.id}`} className="btn ghost">← Retour au builder</Link>
        <label className="row small">
          <input type="checkbox" checked={withRules} onChange={(e) => setWithRules(e.target.checked)} />
          Inclure le rappel des compétences et des objets
        </label>
        <button
          className="btn primary"
          disabled={pdfBusy}
          onClick={async () => {
            setPdfBusy(true)
            try {
              await downloadSheetsPdf(crew, faction, withRules)
            } finally {
              setPdfBusy(false)
            }
          }}
        >
          {pdfBusy ? 'Création du PDF…' : '⬇ Télécharger le PDF'}
        </button>
      </div>
      <p className="muted small no-print sheets-hint">
        Le PDF contient toute la bande (campagne, trésor, historique) : gardez-le comme sauvegarde, ou réimportez-le sur un autre appareil depuis « Mes bandes » → « Importer une bande ».
      </p>

      <header className="sheet-crew">
        <h1>{crew.name || 'Bande sans nom'}</h1>
        <p>
          {faction.name} · {members.length} membres ·{' '}
          {crew.campaign
            ? `Trésor : ${crew.campaign.po} PO, ${crew.campaign.cristaux} cristaux, ${crew.campaign.prestige} prestige · ${crew.campaign.games.length} partie(s) ·`
            : `${crewCost(crew)} / ${crew.budget} PO dépensés · Trésor restant : ${crew.budget - crewCost(crew)} PO ·`}{' '}
          Entretien : {upkeep.po} PO
          {upkeep.cristaux ? ` + ${upkeep.cristaux} cristal` : ''}
        </p>
      </header>

      <div className="sheet-grid" style={{ ['--sheet-rows' as string]: 4 + sheetRows }}>
        {members.map((m) => {
          // Toutes les fiches ont les mêmes lignes, pour qu'elles s'alignent d'une fiche à l'autre.
          const p = profileOf(faction, m)
          if (!p) return null
          const loot = lootItems(m)
          const worn = [...wornItems(m).map((e) => e.name), ...loot.filter((l) => l.ref.slot === 'porte').map((l) => l.item?.name ?? '?')]
          const bag = [...bagItems(m).map((e) => e.name), ...loot.filter((l) => l.ref.slot === 'sac').map((l) => l.item?.name ?? '?')]
          const scars = (m.injuries ?? []).map((r) => injuryById(r.cardId)?.name ?? r.cardId)
          const u = memberUpkeep(p, m)
          return (
            <article key={m.id} className="sheet" style={{ gridRow: `span ${4 + sheetRows}` }}>
              <header>
                <h2>{memberName(m) || '—'}</h2>
                <span>{p.name}</span>
              </header>
              <StatLine stats={effectiveStats(p, m)} variant="table" />
              <dl style={{ gridRow: `span ${sheetRows}` }}>
                <dt>Compétences</dt>
                <dd>{memberSkills(p, m).join(', ') || '—'}</dd>
                <dt>Équipement porté</dt>
                <dd>{worn.join(', ') || 'Mains nues'}</dd>
                {anyBag && (
                  <>
                    <dt>Sac à dos</dt>
                    <dd>{bag.join(', ') || '—'}</dd>
                  </>
                )}
                {anySpells && (
                  <>
                    <dt>Sorts</dt>
                    <dd>
                      {(m.spellIds ?? [])
                        .map((id) => spellById(id))
                        .filter((sp) => !!sp)
                        .map((sp) => `${sp!.name} (${sp!.value}+)`)
                        .join(', ') || m.spells || '—'}
                    </dd>
                  </>
                )}
                <dt>Arbres</dt>
                <dd>{p.trees.map((t) => TREE_LABELS[t] ?? t).join(', ') || '—'}</dd>
              </dl>
              <footer className="sheet-facts">
                <div><small>Niveau</small><b>{m.level}</b></div>
                <div><small>XP</small><b>{m.xp}</b></div>
                <div><small>Actions</small><b>{actionsOf(m)}</b></div>
                <div><small>Entretien</small><b>{u.cristaux ? `${u.cristaux} cr.` : `${u.po} PO`}</b></div>
                <div><small>Valeur</small><b>{memberCost(faction, m)} PO</b></div>
                {p.xpValue !== null && <div title="XP gagnée par l'adversaire pour chaque point de vie retiré"><small>XP / PV retiré</small><b>{p.xpValue}</b></div>}
              </footer>
              <div className="sheet-blank">
                <span>Blessures : {scars.join(', ')}</span>
              </div>
            </article>
          )
        })}
      </div>

      {withRules && usedSkills.length > 0 && (
        <section className="sheet-rules">
          <h2>Rappel des compétences</h2>
          <dl>
            {usedSkills.map((name) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{skillByName(name)?.description ?? 'Pas encore de description dans les règles.'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {withRules && carried.length > 0 && (
        <section className="sheet-rules">
          <h2>Rappel des objets</h2>
          <dl>
            {carried.map((it) => (
              <div key={it.name}>
                <dt>{it.name}</dt>
                <dd>{it.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </section>
  )
}
