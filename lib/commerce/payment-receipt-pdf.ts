import 'server-only'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { displayDate, paymentMethodLabel } from '@/lib/admin/sales-reporting'
import { getAsset } from '@/lib/content/asset-registry'
import { formatRupiah } from './money'
import type { PaymentReceipt } from './payment-receipt'

const PAGE = { width: 595.28, height: 841.89, margin: 42, bottom: 765 }
const WIDTH = PAGE.width - PAGE.margin * 2
const RIGHT = PAGE.width - PAGE.margin
const COLOR = {
  ink: rgb(.14, .13, .12), muted: rgb(.43, .42, .40), rule: rgb(.88, .87, .85),
  orange: rgb(1, .478, 0), tint: rgb(1, .96, .92), paper: rgb(.975, .974, .97),
  paid: rgb(.12, .40, .29), paidTint: rgb(.92, .97, .94),
}

// Only approved public branding is cached. Receipt/customer data stays request-local.
let assets: Promise<[Buffer, Buffer, Buffer]> | undefined
function brandAssets() {
  if (!assets) assets = Promise.all([
    readFile(join(process.cwd(), 'public', getAsset('brand.logo.primary').src.replace(/^\//, ''))),
    readFile(join(process.cwd(), 'public', getAsset('brand.font.receipt').src.replace(/^\//, ''))),
    readFile(join(process.cwd(), 'public', getAsset('brand.font.receipt.semibold').src.replace(/^\//, ''))),
  ]).catch(error => { assets = undefined; throw error })
  return assets
}

function receiptAmounts(receipt: PaymentReceipt) {
  const money = [receipt.gross, receipt.discount, receipt.net, ...receipt.items.flatMap(item => [item.gross, item.discount, item.net])]
  if (receipt.currency !== 'IDR' || money.some(value => !Number.isSafeInteger(value) || value < 0) ||
    receipt.gross - receipt.discount !== receipt.net || !receipt.items.length ||
    receipt.items.some(item => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    throw new Error('Receipt snapshots require reconciliation')
  }
  // Legacy items need not have an allocated discount. Order totals remain canonical.
}

function linesFor(value: string, font: PDFFont, size: number, width: number) {
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() || 'Unavailable'
  const lines: string[] = []
  let line = ''
  for (const word of clean.split(' ')) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue }
    if (line) { lines.push(line); line = '' }
    // Break long references/emails as well as ordinary words, without truncation.
    for (const character of Array.from(word)) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = '' }
      line += character
    }
  }
  if (line) lines.push(line)
  return lines
}

type Field = { label: string; value: string }
type TextStyle = { size?: number; bold?: boolean; color?: RGB }

export async function generatePaymentReceipt(receipt: PaymentReceipt): Promise<Uint8Array> {
  receiptAmounts(receipt)
  const [logoBytes, regularBytes, semiboldBytes] = await brandAssets()
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const regular = await pdf.embedFont(regularBytes, { subset: true })
  const semibold = await pdf.embedFont(semiboldBytes, { subset: true })
  const logo = await pdf.embedPng(logoBytes)
  const reference = receipt.invoice ?? receipt.order_id
  pdf.setTitle(`Strativate Payment Receipt ${reference}`)
  pdf.setAuthor('Strativate')
  pdf.setCreator('Strativate')
  pdf.setProducer('Strativate transaction records')
  let page: PDFPage
  // All layout positions are measured from the top of the page.
  let y = 0

  function text(value: string, x: number, top: number, style: TextStyle = {}) {
    const { size = 9, bold = false, color = COLOR.ink } = style
    page.drawText(value, { x, y: PAGE.height - top - size, size, font: bold ? semibold : regular, color })
  }
  function rect(x: number, top: number, width: number, height: number, color: RGB) {
    page.drawRectangle({ x, y: PAGE.height - top - height, width, height, color })
  }
  function rule(top: number, x = PAGE.margin, width = WIDTH, color = COLOR.rule, thickness = .6) {
    page.drawLine({ start: { x, y: PAGE.height - top }, end: { x: x + width, y: PAGE.height - top }, color, thickness })
  }
  function rightText(value: string, right: number, top: number, width: number, style: TextStyle = {}) {
    const font = style.bold ? semibold : regular
    const size = Math.min(style.size ?? 9, width / Math.max(1, font.widthOfTextAtSize(value, 1)))
    text(value, right - font.widthOfTextAtSize(value, size), top, { ...style, size })
  }
  function newPage(first = false) {
    page = pdf.addPage([PAGE.width, PAGE.height])
    const dimensions = logo.scaleToFit(first ? 139 : 119, 27)
    page.drawImage(logo, { x: PAGE.margin, y: PAGE.height - 42 - dimensions.height, ...dimensions })
    rect(RIGHT - 62, 41, 62, 25, COLOR.paidTint)
    text('PAID', RIGHT - 44, 47, { size: 9, bold: true, color: COLOR.paid })
    rule(87, PAGE.margin, WIDTH, COLOR.orange, 1.7)
    y = 105
    if (!first) {
      text('Payment receipt', PAGE.margin, y, { size: 11, bold: true })
      rightText('Continued', RIGHT, y + 2, 120, { size: 8, color: COLOR.muted })
      y += 31
    }
  }
  function space(height: number) {
    if (y + height > PAGE.bottom) newPage()
  }

  // A field may span pages, but its label always stays with at least one value line.
  function field(label: string, value: string, x = PAGE.margin, width = WIDTH, size = 9) {
    const lines = linesFor(value, regular, size, width)
    let offset = 0
    while (offset < lines.length) {
      space(29)
      text(offset ? `${label} (continued)` : label, x, y, { size: 7.5, bold: true, color: COLOR.muted })
      y += 13
      const count = Math.min(lines.length - offset, Math.floor((PAGE.bottom - y) / 13))
      for (const line of lines.slice(offset, offset + count)) { text(line, x, y, { size }); y += 13 }
      offset += count
      if (offset < lines.length) newPage()
    }
    y += 7
  }

  // The columns advance independently, resuming only their remaining fields/lines.
  // Even exceptionally long customer/provider references never repeat header data.
  function columns(groups: Array<{ title: string; fields: Field[] }>, size = 9) {
    const gap = 28
    const width = (WIDTH - gap) / 2
    const lineHeight = size <= 8 ? 12 : 13
    const fieldGap = size <= 8 ? 6 : 7
    const states = groups.map(group => ({
      title: group.title,
      fields: group.fields.map(entry => ({ ...entry, lines: linesFor(entry.value, regular, size, width) })),
      index: 0, offset: 0,
    }))
    while (states.some(state => state.index < state.fields.length)) {
      const remainingHeight = Math.max(...states.map(state => state.fields.slice(state.index).reduce((height, entry, index) => {
        const label = index === 0 && state.offset ? `${entry.label} (continued)` : entry.label
        const labelHeight = linesFor(label, semibold, 7.3, width).length * 11 + 2
        return height + labelHeight + (entry.lines.length - (index === 0 ? state.offset : 0)) * lineHeight + fieldGap
      }, 0)))
      space(Math.min(180, 24 + remainingHeight))
      const start = y
      const ends = states.map((state, column) => {
        if (state.index >= state.fields.length) return start
        const x = PAGE.margin + column * (width + gap)
        text(state.title, x, start, { size: 8, bold: true })
        rule(start + 19, x, width)
        let cursor = start + 24
        while (state.index < state.fields.length) {
          const entry = state.fields[state.index]
          const labels = linesFor(state.offset ? `${entry.label} (continued)` : entry.label, semibold, 7.3, width)
          const labelHeight = labels.length * 11 + 2
          const count = Math.min(entry.lines.length - state.offset, Math.floor((PAGE.bottom - cursor - labelHeight) / lineHeight))
          if (count < 1) break
          labels.forEach((line, index) => text(line, x, cursor + index * 11, { size: 7.3, bold: true, color: COLOR.muted }))
          cursor += labelHeight
          entry.lines.slice(state.offset, state.offset + count).forEach(line => { text(line, x, cursor, { size }); cursor += lineHeight })
          state.offset += count
          if (state.offset < entry.lines.length) break
          state.offset = 0
          state.index++
          cursor += fieldGap
        }
        return cursor
      })
      y = Math.max(...ends)
      if (states.some(state => state.index < state.fields.length)) newPage()
    }
    y += 10
  }

  newPage(true)
  text('Payment receipt', PAGE.margin, y, { size: 25, bold: true })
  y += 34
  text('Bukti pembayaran', PAGE.margin, y, { size: 10, color: COLOR.muted })
  y += 21
  field('INVOICE NUMBER', reference, PAGE.margin, WIDTH, 10)
  y += 3
  columns([
    { title: 'CUSTOMER', fields: [
      { label: 'Name', value: receipt.customer ?? receipt.email ?? 'Customer name unavailable' },
      { label: 'Email', value: receipt.email ?? 'Unavailable' },
    ] },
    { title: 'TRANSACTION', fields: [
      { label: 'Order reference', value: receipt.order_id },
      { label: receipt.legacy_paid ? 'Payment reporting date · WIB (historical fallback)' : 'Payment date · WIB', value: displayDate(receipt.recognized_at, true) },
      { label: 'Purchase date · WIB', value: displayDate(receipt.created_at, true) },
    ] },
  ])

  const table = {
    item: { x: PAGE.margin, width: 176 },
    quantity: { right: PAGE.margin + 248, width: 61 },
    unit: { right: PAGE.margin + 379, width: 119 },
    subtotal: { right: RIGHT, width: 120 },
  }
  const preparedItems = receipt.items.map(item => {
    const name = linesFor(item.name, regular, 9, table.item.width - 8)
    // Preserve an exact ratio when an historical subtotal is indivisible by quantity.
    const fractional = item.gross % item.quantity !== 0
    const unit = fractional ? `${formatRupiah(item.gross)} / ${item.quantity}` : formatRupiah(item.gross / item.quantity)
    const unitLines = linesFor(unit, regular, 8.2, table.unit.width)
    const rowLines = Math.max(name.length, unitLines.length)
    return { item, name, fractional, unitLines, rowLines, rowHeight: rowLines * 14 + 16 }
  })
  const fullPageRowHeight = PAGE.bottom - 186
  function tableHeader(continued = false, firstRowHeight = 30) {
    // Reserve both the heading and a first row; never leave a table header orphaned.
    space(50 + firstRowHeight)
    text(continued ? 'Purchased items · continued' : 'Purchased items', PAGE.margin, y, { size: 11, bold: true })
    y += 23
    rect(PAGE.margin, y, WIDTH, 27, COLOR.paper)
    text('ITEM', table.item.x + 8, y + 8, { size: 7.3, bold: true, color: COLOR.muted })
    rightText('QTY', table.quantity.right, y + 8, table.quantity.width, { size: 7.3, bold: true, color: COLOR.muted })
    rightText('UNIT PRICE', table.unit.right, y + 8, table.unit.width, { size: 7.3, bold: true, color: COLOR.muted })
    rightText('SUBTOTAL', table.subtotal.right - 8, y + 8, table.subtotal.width, { size: 7.3, bold: true, color: COLOR.muted })
    y += 27
  }
  function tablePage() { newPage(); tableHeader(true) }
  const firstRow = preparedItems[0].rowHeight
  tableHeader(false, firstRow <= fullPageRowHeight ? firstRow : 44)
  for (const { item, name, unitLines, rowLines, rowHeight } of preparedItems) {
    // Ordinary rows move intact. Rows taller than a page are split with an explicit
    // continuation label; financial cells appear only on the first fragment.
    if (rowHeight <= fullPageRowHeight && y + rowHeight > PAGE.bottom) tablePage()
    let offset = 0
    while (offset < rowLines) {
      const continuation = offset > 0
      const captionHeight = continuation ? 13 : 0
      const minimumHeight = 16 + captionHeight + 14 * (continuation ? 1 : unitLines.length)
      if (PAGE.bottom - y < minimumHeight) tablePage()
      const count = Math.min(rowLines - offset, Math.floor((PAGE.bottom - y - 16 - captionHeight) / 14))
      const top = y + 8
      if (continuation) text('Item continued', table.item.x, top, { size: 7, color: COLOR.muted })
      const contentTop = top + captionHeight
      name.slice(offset, offset + count).forEach((line, index) => text(line, table.item.x, contentTop + index * 14, { size: 9 }))
      if (!continuation) {
        rightText(String(item.quantity), table.quantity.right, contentTop, table.quantity.width, { size: 8.2 })
        unitLines.forEach((line, index) => rightText(line, table.unit.right, contentTop + index * 14, table.unit.width, { size: 8.2 }))
        rightText(formatRupiah(item.gross), table.subtotal.right, contentTop, table.subtotal.width, { size: 8.2 })
      }
      y += count * 14 + 16 + captionHeight
      rule(y)
      offset += count
      if (offset < rowLines) tablePage()
    }
  }
  if (preparedItems.some(item => item.fractional)) {
    space(30)
    y += 9
    text('Non-whole unit prices are shown as subtotal / quantity.', PAGE.margin, y, { size: 7, color: COLOR.muted })
    y += 19
  }
  y += 21

  const summaryWidth = 300
  const summaryX = RIGHT - summaryWidth
  const codeLines = receipt.discount > 0 && receipt.discount_code ? linesFor(receipt.discount_code, regular, 8.2, summaryWidth) : []
  const summaryHeight = 22 + (receipt.discount > 0 ? 22 : 0) + (codeLines.length ? 20 + codeLines.length * 13 : 0) + 69
  // Keep a normal summary together; only an unbounded discount code may span pages.
  space(summaryHeight <= PAGE.bottom - 136 ? summaryHeight : 150)
  function amount(label: string, value: string) {
    space(22)
    text(label, summaryX, y, { size: 9, color: COLOR.muted })
    rightText(value, RIGHT, y, 176, { size: 9 })
    y += 22
  }
  amount('Subtotal', formatRupiah(receipt.gross))
  if (receipt.discount > 0) {
    amount('Discount', `−${formatRupiah(receipt.discount)}`)
    if (receipt.discount_code) field('Discount code', receipt.discount_code, summaryX, summaryWidth, 8.2)
  }
  space(69)
  rect(summaryX - 12, y, summaryWidth + 12, 60, COLOR.tint)
  text('TOTAL PAID · IDR', summaryX, y + 10, { size: 8, bold: true })
  rightText(formatRupiah(receipt.net), RIGHT - 12, y + 27, summaryWidth - 12, { size: 18, bold: true })
  y += 78

  if (receipt.payment) {
    const payment: Field[] = []
    if (receipt.payment.method) payment.push({ label: 'Method', value: paymentMethodLabel(receipt.payment.method) })
    payment.push({ label: 'Provider', value: receipt.payment.provider })
    const references: Field[] = []
    if (receipt.payment.reference) references.push({ label: 'Payment reference', value: receipt.payment.reference })
    if (receipt.payment.provider_order_id) references.push({ label: 'Provider order reference', value: receipt.payment.provider_order_id })
    columns([{ title: 'PAYMENT DETAILS', fields: payment }, { title: 'REFERENCES', fields: references }], 8)
  }
  const pages = pdf.getPages()
  pages.forEach((current, index) => {
    page = current
    rule(791)
    text('Generated from Strativate transaction records. This is a payment receipt.', PAGE.margin, 803, { size: 7, color: COLOR.muted })
    rightText(`Page ${index + 1} of ${pages.length}`, RIGHT, 803, 100, { size: 7, color: COLOR.muted })
  })
  return pdf.save()
}
