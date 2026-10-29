import type { jsPDF } from 'jspdf'
import { safe } from './pdf'
import { QUICK_REF, woundRoll, type QuickBlock, type QuickPart } from './quickref'

// Mise en page A4 portrait, en millimètres (comme les fiches de bande).
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 12
const GAP = 5
const COL_W = (PAGE_W - 2 * MARGIN - GAP) / 2
const FOOTER_H = 8
const SIZE = 7.3
const LINE = 3.05
const PAD = 2.5

/** Liens réduits à leur texte, symboles absents des polices standard remplacés. */
const qsafe = (s: string) =>
  safe(s.replace(/\[(.+?)\]\(.+?\)/g, '$1').replace(/«\s*/g, '"').replace(/\s*»/g, '"')).replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-')

interface Word {
  t: string
  b: boolean
  w: number
}

/** Coupe un texte (`**gras**` reconnu) en lignes de mots qui tiennent dans `width`. */
function wrapRich(doc: jsPDF, text: string, width: number, size = SIZE, allBold = false): Word[][] {
  const words: Word[] = []
  qsafe(text)
    .split(/(\*\*.+?\*\*)/)
    .forEach((seg) => {
      const marked = seg.startsWith('**') && seg.endsWith('**')
      const b = allBold || marked
      doc.setFont('helvetica', b ? 'bold' : 'normal').setFontSize(size)
      for (const t of (marked ? seg.slice(2, -2) : seg).split(/\s+/).filter(Boolean)) words.push({ t, b, w: doc.getTextWidth(t) })
    })
  doc.setFont('helvetica', 'normal').setFontSize(size)
  const space = doc.getTextWidth(' ')
  const lines: Word[][] = [[]]
  let used = 0
  for (const word of words) {
    const line = lines[lines.length - 1]
    const need = (line.length ? space : 0) + word.w
    if (line.length && used + need > width) {
      lines.push([word])
      used = word.w
    } else {
      line.push(word)
      used += need
    }
  }
  return lines
}

function drawRich(doc: jsPDF, lines: Word[][], x: number, y: number, size = SIZE) {
  doc.setFont('helvetica', 'normal').setFontSize(size)
  const space = doc.getTextWidth(' ')
  lines.forEach((line, i) => {
    let cx = x
    for (const word of line) {
      doc.setFont('helvetica', word.b ? 'bold' : 'normal').setFontSize(size).text(word.t, cx, y + i * LINE)
      cx += word.w + space
    }
  })
}

/** Dessine (ou mesure seulement, si `draw` est faux) un élément de bloc ; renvoie sa hauteur. */
function quickPart(doc: jsPDF, part: QuickPart, x: number, y0: number, w: number, draw: boolean): number {
  let y = y0
  const small = SIZE - 0.5

  const para = (text: string, px: number, pw: number, marker?: string, size = SIZE, allBold = false) => {
    const lines = wrapRich(doc, text, pw, size, allBold)
    if (draw) {
      if (marker) doc.setFont('helvetica', 'bold').setFontSize(size).text(marker, px - 3.5, y + 2.6)
      drawRich(doc, lines, px, y + 2.6, size)
    }
    y += lines.length * LINE + 0.6
  }
  const cell = (text: string, cx: number, cy: number, cw: number, ch: number, opts: { head?: boolean; bold?: boolean } = {}) => {
    if (!draw) return
    doc.setDrawColor(150).setLineWidth(0.15)
    if (opts.head) doc.setFillColor(232, 232, 232).rect(cx, cy, cw, ch, 'FD')
    else doc.rect(cx, cy, cw, ch)
    doc.setFont('helvetica', opts.head || opts.bold ? 'bold' : 'normal').setFontSize(small)
    doc.text(qsafe(text), cx + cw / 2, cy + ch / 2 + 1, { align: 'center' })
  }
  const widest = (texts: string[]) => {
    doc.setFont('helvetica', 'bold').setFontSize(small)
    return Math.max(...texts.map((t) => doc.getTextWidth(qsafe(t))))
  }

  switch (part.kind) {
    case 'note':
      if (draw) doc.setTextColor(90)
      para(part.text, x, w)
      if (draw) doc.setTextColor(0)
      break

    case 'list':
      part.items.forEach((it, i) => {
        const marker = part.ordered ? `${i + 1}.` : '•'
        para(typeof it === 'string' ? it : it.text, x + 4, w - 4, marker)
        if (typeof it !== 'string') for (const sub of it.sub) para(sub, x + 8, w - 8, '-')
      })
      break

    case 'grid': {
      if (part.caption) para(part.caption, x, w, undefined, small, true)
      const headW = widest(part.rows.map((r) => r[0])) + 3
      const cw = Math.min(12, (w - headW) / (part.rows[0].length - 1))
      for (const [head, ...cells] of part.rows) {
        cell(head, x, y, headW, 4.1, { head: true })
        cells.forEach((c, i) => cell(c, x + headW + i * cw, y, cw, 4.1))
        y += 4.1
      }
      y += 1.2
      break
    }

    case 'mods':
      for (const t of part.tables) {
        para(t.caption, x, w, undefined, small, true)
        const vw = widest(t.rows.map((r) => r[0])) + 3
        for (const [v, label] of t.rows) {
          const lines = wrapRich(doc, label, w - vw - 2.4, small)
          const h = Math.max(3.9, lines.length * LINE + 0.9)
          cell(v, x, y, vw, h, { bold: true })
          if (draw) {
            doc.setDrawColor(150).setLineWidth(0.15).rect(x + vw, y, w - vw, h)
            drawRich(doc, lines, x + vw + 1.2, y + 2.9, small)
          }
          y += h
        }
        y += 1.2
      }
      break

    case 'defs': {
      doc.setFont('helvetica', 'bold').setFontSize(SIZE)
      const dw = Math.max(...part.rows.map((r) => doc.getTextWidth(qsafe(r[0])))) + 4
      for (const [dt, dd] of part.rows) {
        const lines = wrapRich(doc, dd, w - dw)
        if (draw) {
          doc.setFont('helvetica', 'bold').setFontSize(SIZE).text(qsafe(dt), x, y + 2.6)
          drawRich(doc, lines, x + dw, y + 2.6)
        }
        y += lines.length * LINE + 0.7
      }
      break
    }

    case 'wound': {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const cw = Math.min(13, w / 11)
      const ch = 4.1
      const x0 = x + (w - cw * 11) / 2
      para('Résultat à obtenir sur 1D10 pour blesser (Force en lignes, Endurance en colonnes)', x0, cw * 11, undefined, small, true)
      cell('F \\ E', x0, y, cw, ch, { head: true })
      values.forEach((e, i) => cell(String(e), x0 + (i + 1) * cw, y, cw, ch, { head: true }))
      y += ch
      for (const f of values) {
        cell(String(f), x0, y, cw, ch, { head: true })
        values.forEach((e, i) => cell(`${woundRoll(f, e)}+`, x0 + (i + 1) * cw, y, cw, ch, { bold: f === e }))
        y += ch
      }
      y += 1.2
      para(
        "6+ quand la force égale l'endurance, puis 1 de moins par point de force en plus, 1 de plus par point d'endurance en plus. Jamais mieux que 2+ ni pire que 10+.",
        x0,
        cw * 11,
      )
      break
    }
  }
  return y - y0
}

/**
 * Un bloc encadré avec son titre ; renvoie sa hauteur (sans rien dessiner si `draw` est faux).
 * `minH` étire le cadre pour que deux blocs d'une même rangée aient la même hauteur.
 */
function quickBlock(doc: jsPDF, b: QuickBlock, x: number, y: number, w: number, draw: boolean, minH = 0): number {
  let cy = y + PAD
  if (draw) {
    doc.setFont('helvetica', 'bold').setFontSize(10).text(qsafe(b.title), x + PAD, cy + 3.2)
    doc.setDrawColor(150).setLineWidth(0.2).line(x + PAD, cy + 4.6, x + w - PAD, cy + 4.6)
  }
  cy += 6.2
  for (const part of b.parts) cy += quickPart(doc, part, x + PAD, cy, w - 2 * PAD, draw)
  const h = Math.max(minH, cy - y + PAD - 0.6)
  if (draw) doc.setDrawColor(110).setLineWidth(0.3).roundedRect(x, y, w, h, 1.5, 1.5)
  return h
}

/** Aide-mémoire des règles en PDF A4, dans l'ordre de la page : sections, puis blocs par rangées de deux. */
export async function downloadQuickRefPdf() {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  doc.setProperties({ title: 'Amatika - aide-memoire', creator: 'Builder Amatika' })
  const bottom = PAGE_H - MARGIN - FOOTER_H
  const fullW = PAGE_W - 2 * MARGIN
  const HEAD_H = 7

  doc.setFont('helvetica', 'bold').setFontSize(16).text(qsafe('Amatika - aide-mémoire'), MARGIN, MARGIN + 5)
  let y = MARGIN + 9

  QUICK_REF.forEach((section, n) => {
    // Rangées : un bloc large seul, sinon deux blocs côte à côte (ou un dernier seul).
    const rows: QuickBlock[][] = []
    for (const b of section.blocks) {
      const last = rows[rows.length - 1]
      if (!b.wide && last && last.length === 1 && !last[0].wide) last.push(b)
      else rows.push([b])
    }
    rows.forEach((row, r) => {
      const w = row[0].wide ? fullW : COL_W
      const h = Math.max(...row.map((b) => quickBlock(doc, b, 0, 0, w, false)))
      // Le titre de section reste avec sa première rangée.
      const need = (r === 0 ? HEAD_H : 0) + h
      if (y + need > bottom) {
        doc.addPage()
        y = MARGIN
      }
      if (r === 0) {
        doc.setFont('helvetica', 'bold').setFontSize(12).text(qsafe(`${n + 1}. ${section.title}`), MARGIN, y + 4.5)
        doc.setDrawColor(60).setLineWidth(0.4).line(MARGIN, y + 5.8, PAGE_W - MARGIN, y + 5.8)
        y += HEAD_H
      }
      row.forEach((b, i) => quickBlock(doc, b, MARGIN + i * (COL_W + GAP), y, w, true, h))
      y += h + GAP - 1
    })
    y += 1.5
  })

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(110)
    doc.text(qsafe('Builder Amatika - aide-mémoire des règles'), MARGIN, PAGE_H - 6)
    doc.text(`${i} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' })
    doc.setTextColor(0)
  }
  doc.save('amatika-aide-memoire.pdf')
}
