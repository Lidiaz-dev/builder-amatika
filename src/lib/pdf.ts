import type { jsPDF } from 'jspdf'
import { injuryById, skillByName, spellById, STAT_COLUMNS, TREE_LABELS, type Faction } from '../data'
import {
  actionsOf,
  bagItems,
  crewCost,
  crewUpkeep,
  effectiveStats,
  isActive,
  lootItems,
  memberCost,
  memberName,
  memberSkills,
  memberUpkeep,
  profileOf,
  wornItems,
  type Crew,
  type Member,
} from './crew'
import { crewToKeywords } from './crewFile'

// Mise en page A4 portrait, en millimètres.
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 12
const GAP = 6
const COL_W = (PAGE_W - 2 * MARGIN - GAP) / 2
const PAD = 3
const LINE = 3.6
const FOOTER_H = 8

/** Le PDF n'embarque que les polices standard (encodage WinAnsi) : on remplace les caractères absents. */
const safe = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/✝/g, '+')

const fmt = (v: number | null, dice: boolean) => (v === null ? '/' : dice ? `${v}+` : String(v))

interface Row {
  label: string
  value: string
}

function memberRows(faction: Faction, m: Member): Row[] {
  const p = profileOf(faction, m)!
  const loot = lootItems(m)
  const worn = [...wornItems(m).map((e) => e.name), ...loot.filter((l) => l.ref.slot === 'porte').map((l) => l.item?.name ?? '?')]
  const bag = [...bagItems(m).map((e) => e.name), ...loot.filter((l) => l.ref.slot === 'sac').map((l) => l.item?.name ?? '?')]
  const spells = (m.spellIds ?? []).map((id) => spellById(id)).filter((s) => !!s).map((s) => `${s!.name} (${s!.value}+)`)
  const rows: Row[] = [
    { label: 'Compétences', value: memberSkills(p, m).join(', ') || '-' },
    { label: 'Équipement porté', value: worn.join(', ') || 'Mains nues' },
  ]
  if (bag.length) rows.push({ label: 'Sac à dos', value: bag.join(', ') })
  if (spells.length || m.spells) rows.push({ label: 'Sorts', value: spells.join(', ') || m.spells })
  rows.push({ label: 'Arbres', value: p.trees.map((t) => TREE_LABELS[t] ?? t).join(', ') || '-' })
  return rows
}

const LABEL_W = 27

/** Dessine une fiche (ou mesure sa hauteur si draw = false). Renvoie la hauteur utilisée. */
function drawSheet(doc: jsPDF, faction: Faction, m: Member, x: number, y: number, draw: boolean): number {
  const p = profileOf(faction, m)!
  const stats = effectiveStats(p, m)
  const inner = COL_W - 2 * PAD
  let cy = y + PAD

  // En-tête : nom et profil.
  if (draw) {
    doc.setFont('helvetica', 'bold').setFontSize(11.5).text(safe(memberName(m) || '-'), x + PAD, cy + 4)
    doc.setFont('helvetica', 'normal').setFontSize(9).text(safe(`${m.promotedChef ? 'Chef - ' : ''}${p.name}`), x + COL_W - PAD, cy + 4, { align: 'right' })
    doc.setLineWidth(0.4).line(x + PAD, cy + 6, x + COL_W - PAD, cy + 6)
  }
  cy += 8.5

  // Caractéristiques : 10 cases carrées identiques.
  const cell = inner / STAT_COLUMNS.length
  if (draw) {
    doc.setFont('helvetica', 'bold').setFontSize(6.5)
    STAT_COLUMNS.forEach((c, i) => doc.text(c.label.toUpperCase(), x + PAD + cell * i + cell / 2, cy + 2.3, { align: 'center' }))
    doc.setLineWidth(0.3)
    doc.setFontSize(10.5)
    STAT_COLUMNS.forEach((c, i) => {
      const cx = x + PAD + cell * i
      doc.rect(cx, cy + 3.2, cell, cell)
      doc.text(fmt(stats[c.key], c.dice), cx + cell / 2, cy + 3.2 + cell / 2 + 1.4, { align: 'center' })
    })
  }
  cy += 3.2 + cell + 3

  // Lignes : libellé en gras, valeur sur plusieurs lignes si besoin.
  doc.setFontSize(8)
  for (const r of memberRows(faction, m)) {
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(safe(r.value), inner - LABEL_W) as string[]
    if (draw) {
      doc.setFont('helvetica', 'bold').text(safe(r.label), x + PAD, cy + 2.6)
      doc.setFont('helvetica', 'normal').text(lines, x + PAD + LABEL_W, cy + 2.6)
    }
    cy += lines.length * LINE + 0.6
  }

  // Pied : niveau, entretien, valeur.
  const u = memberUpkeep(p, m)
  cy += 1
  if (draw) {
    doc.setLineDashPattern([0.8, 0.8], 0).setLineWidth(0.2).line(x + PAD, cy, x + COL_W - PAD, cy).setLineDashPattern([], 0)
    doc.setFont('helvetica', 'normal').setFontSize(7.5)
    doc.text(safe(`Niv. ${m.level} - XP ${m.xp} - ${actionsOf(m)} actions`), x + PAD, cy + 3.5)
    doc.text(safe(`Entretien ${u.cristaux ? `${u.cristaux} cristal` : `${u.po} PO`}`), x + COL_W / 2, cy + 3.5, { align: 'center' })
    doc.text(`Valeur ${memberCost(faction, m)} PO`, x + COL_W - PAD, cy + 3.5, { align: 'right' })
  }
  cy += 5.5

  // Blessures : celles connues, puis de la place pour écrire à la main.
  const scars = (m.injuries ?? []).map((r) => injuryById(r.cardId)?.name ?? r.cardId).join(', ')
  doc.setFontSize(8)
  const scarLines = doc.splitTextToSize(safe(scars), inner - 17) as string[]
  if (draw) {
    doc.setFont('helvetica', 'bold').text('Blessures', x + PAD, cy + 2.6)
    if (scars) doc.setFont('helvetica', 'normal').text(scarLines, x + PAD + 17, cy + 2.6)
  }
  cy += Math.max(1, scars ? scarLines.length : 0) * LINE + 1
  // Deux lignes vides pour noter en cours de campagne.
  if (draw) {
    doc.setLineWidth(0.15).setDrawColor(150)
    doc.line(x + PAD, cy + 3, x + COL_W - PAD, cy + 3)
    doc.line(x + PAD, cy + 7.5, x + COL_W - PAD, cy + 7.5)
    doc.setDrawColor(0)
  }
  cy += 9

  const h = cy - y + PAD - 1
  if (draw) {
    doc.setLineWidth(0.5).rect(x, y, COL_W, h)
    doc.setLineWidth(0.15).rect(x + 1, y + 1, COL_W - 2, h - 2)
  }
  return h
}

function pageFooter(doc: jsPDF, crew: Crew) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(110)
    doc.text(safe(`${crew.name || 'Bande sans nom'} - Builder Amatika - ce PDF peut être réimporté dans « Mes bandes »`), MARGIN, PAGE_H - 6)
    doc.text(`${i} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' })
    doc.setTextColor(0)
  }
}

/** Fiches de la bande en PDF A4, noir et blanc, prêtes à imprimer. */
export async function downloadSheetsPdf(crew: Crew, faction: Faction, withRules: boolean) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  // La bande entière est glissée dans le PDF pour pouvoir la réimporter dans le builder.
  doc.setProperties({
    title: safe(`${crew.name || 'Bande sans nom'} - fiches`),
    subject: 'Fiches de bande Amatika (fichier importable dans Builder Amatika)',
    creator: 'Builder Amatika',
    keywords: crewToKeywords(crew),
  })
  const members = crew.members.filter(isActive)
  const bottom = PAGE_H - MARGIN - FOOTER_H

  // En-tête de la bande.
  doc.setFont('helvetica', 'bold').setFontSize(18).text(safe(crew.name || 'Bande sans nom'), MARGIN, MARGIN + 6)
  const upkeep = crewUpkeep(crew)
  const summary = crew.campaign
    ? `${faction.name} - ${members.length} membres - Trésor : ${crew.campaign.po} PO, ${crew.campaign.cristaux} cristaux, ${crew.campaign.prestige} prestige - ${crew.campaign.games.length} partie(s) - Entretien : ${upkeep.po} PO`
    : `${faction.name} - ${members.length} membres - ${crewCost(crew)} / ${crew.budget} PO dépensés - Trésor restant : ${crew.budget - crewCost(crew)} PO - Entretien : ${upkeep.po} PO`
  doc.setFont('helvetica', 'normal').setFontSize(9).text(doc.splitTextToSize(safe(summary), PAGE_W - 2 * MARGIN), MARGIN, MARGIN + 12)
  doc.setLineWidth(0.6).line(MARGIN, MARGIN + 17, PAGE_W - MARGIN, MARGIN + 17)

  // Fiches sur deux colonnes : chaque fiche va dans la colonne la moins remplie.
  const top = MARGIN + 21
  const cols = [top, top]
  for (const m of members) {
    if (!profileOf(faction, m)) continue
    const h = drawSheet(doc, faction, m, 0, 0, false)
    let c = cols[0] <= cols[1] ? 0 : 1
    if (cols[c] + h > bottom) c = 1 - c
    if (cols[c] + h > bottom) {
      doc.addPage()
      cols[0] = cols[1] = MARGIN
      c = 0
    }
    drawSheet(doc, faction, m, MARGIN + c * (COL_W + GAP), cols[c], true)
    cols[c] += h + GAP
  }

  // Rappel des compétences utilisées.
  if (withRules) {
    const used = [...new Set(members.flatMap((m) => {
      const p = profileOf(faction, m)
      return p ? memberSkills(p, m) : []
    }))]
    if (used.length) {
      doc.addPage()
      doc.setFont('helvetica', 'bold').setFontSize(14).text('Rappel des compétences', MARGIN, MARGIN + 5)
      const ry = [MARGIN + 11, MARGIN + 11]
      let c = 0
      for (const name of used) {
        doc.setFont('helvetica', 'normal').setFontSize(8)
        const desc = skillByName(name)?.description ?? 'Pas encore de description dans les règles.'
        const lines = doc.splitTextToSize(safe(desc), COL_W) as string[]
        const h = 4 + lines.length * LINE + 2
        if (ry[c] + h > bottom) c = 1 - c
        if (ry[c] + h > bottom) {
          doc.addPage()
          ry[0] = ry[1] = MARGIN
          c = 0
        }
        const x = MARGIN + c * (COL_W + GAP)
        doc.setFont('helvetica', 'bold').setFontSize(9).text(safe(name), x, ry[c] + 3)
        doc.setFont('helvetica', 'normal').setFontSize(8).text(lines, x, ry[c] + 7)
        ry[c] += h
      }
    }
  }

  pageFooter(doc, crew)
  const file = (crew.name || 'bande').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  doc.save(`${file || 'bande'}-fiches.pdf`)
}
