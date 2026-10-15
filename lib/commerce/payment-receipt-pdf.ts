import 'server-only'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { displayDate, paymentMethodLabel } from '@/lib/admin/sales-reporting'
import { getAsset } from '@/lib/content/asset-registry'
import { formatRupiah } from './money'
import type { PaymentReceipt } from './payment-receipt'

const PAGE = { width: 595.28, height: 841.89, margin: 42, bottom: 70 }
const INK = rgb(.19, .16, .14), MUTED = rgb(.47, .43, .39), ORANGE = rgb(1, .48, 0)

// These are public, approved brand assets; transaction data is never cached here.
let assets: Promise<[Buffer, Buffer]> | undefined
function brandAssets() {
  if (!assets) assets = Promise.all([
    readFile(join(process.cwd(), 'public', getAsset('brand.logo.primary').src.replace(/^\//, ''))),
    readFile(join(process.cwd(), 'public', getAsset('brand.font.receipt').src.replace(/^\//, ''))),
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
    // IDs, emails and very long item names must wrap without breaking the page.
    for (const character of Array.from(word)) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = '' }
      line += character
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function generatePaymentReceipt(receipt: PaymentReceipt): Promise<Uint8Array> {
  receiptAmounts(receipt)
  const [logoBytes, fontBytes] = await brandAssets()
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(fontBytes, { subset: true })
  const logo = await pdf.embedPng(logoBytes)
  const reference = receipt.invoice ?? receipt.order_id
  pdf.setTitle(`Strativate Payment Receipt ${reference}`)
  pdf.setAuthor('Strativate')
  pdf.setCreator('Strativate')
  pdf.setProducer('Strativate transaction records')
  const width = PAGE.width - 2 * PAGE.margin
  // newPage() assigns the page before any receipt drawing occurs.
  let page!: PDFPage
  let y = 0

  function text(value: string, x: number, baseline: number, size = 10, muted = false) {
    page.drawText(value, { x, y: baseline, size, font, color: muted ? MUTED : INK })
  }
  function newPage() {
    page = pdf.addPage([PAGE.width, PAGE.height])
    const dimensions = logo.scaleToFit(145, 43)
    page.drawImage(logo, { x: PAGE.margin, y: PAGE.height - 74, ...dimensions })
    text('PAID', PAGE.width - PAGE.margin - 36, PAGE.height - 55, 11)
    page.drawLine({ start: { x: PAGE.margin, y: PAGE.height - 89 }, end: { x: PAGE.width - PAGE.margin, y: PAGE.height - 89 }, thickness: 1.5, color: ORANGE })
    y = PAGE.height - 115
    text('Payment Receipt / Bukti Pembayaran', PAGE.margin, y, 16)
    y -= 25
    for (const line of linesFor(reference, font, 9, width)) { text(line, PAGE.margin, y, 9, true); y -= 14 }
    y -= 12
  }
  function space(height: number) { if (y - height < PAGE.bottom) newPage() }
  function field(label: string, value: string, size = 10) {
    const lines = linesFor(value, font, size, width)
    space(34)
    text(label, PAGE.margin, y, 8, true); y -= 15
    for (const line of lines) { space(15); text(line, PAGE.margin, y, size); y -= 15 }
    y -= 7
  }
  function amount(label: string, value: number, final = false) {
    space(final ? 38 : 24)
    const size = final ? 14 : 10
    const valueText = formatRupiah(value)
    const fitted = Math.min(size, 215 / Math.max(1, font.widthOfTextAtSize(valueText, 1)))
    text(label, PAGE.margin, y, size)
    text(valueText, PAGE.width - PAGE.margin - font.widthOfTextAtSize(valueText, fitted), y, fitted)
    y -= final ? 35 : 22
  }
  newPage()
  field('Order reference', receipt.order_id, 9)
  field('Customer', receipt.customer ?? receipt.email ?? 'Customer name unavailable')
  field('Email', receipt.email ?? 'Unavailable')
  field(receipt.legacy_paid ? 'Payment reporting date · WIB (historical fallback)' : 'Payment date · WIB', displayDate(receipt.recognized_at, true))
  field('Purchase date · WIB', displayDate(receipt.created_at, true))
  space(45)
  text('Purchased items', PAGE.margin, y, 11); y -= 23

  const qtyX = 337, priceX = 466, totalX = PAGE.width - PAGE.margin
  function itemHeader() {
    space(30)
    text('Item', PAGE.margin, y, 8, true)
    text('Qty', qtyX, y, 8, true)
    text('Unit price', priceX - 63, y, 8, true)
    text('Subtotal', totalX - 52, y, 8, true)
    y -= 20
  }
  function rightValue(value: string, right: number, available: number, baseline: number) {
    const size = Math.min(9, available / Math.max(1, font.widthOfTextAtSize(value, 1)))
    text(value, right - font.widthOfTextAtSize(value, size), baseline, size)
  }
  itemHeader()
  for (const item of receipt.items) {
    const itemLines = linesFor(item.name, font, 9, qtyX - PAGE.margin - 18)
    if (y - Math.min(itemLines.length * 14 + 12, 350) < PAGE.bottom) { newPage(); itemHeader() }
    const initialY = y
    rightValue(String(item.quantity), qtyX + 17, 35, initialY)
    rightValue(formatRupiah(item.gross / item.quantity), priceX, 92, initialY)
    rightValue(formatRupiah(item.gross), totalX, 81, initialY)
    for (const line of itemLines) {
      if (y - 14 < PAGE.bottom) { newPage(); itemHeader() }
      text(line, PAGE.margin, y, 9); y -= 14
    }
    page.drawLine({ start: { x: PAGE.margin, y: y - 1 }, end: { x: totalX, y: y - 1 }, thickness: .4, color: rgb(.9, .87, .84) })
    y -= 14
  }
  space(110)
  y -= 5
  amount('Gross subtotal', receipt.gross)
  if (receipt.discount > 0) {
    amount('Applied discount', receipt.discount)
    if (receipt.discount_code) field('Discount code', receipt.discount_code, 9)
  }
  amount('Final paid total · IDR', receipt.net, true)
  if (receipt.payment?.method) field('Payment method', paymentMethodLabel(receipt.payment.method), 9)
  if (receipt.payment) {
    field('Payment provider', receipt.payment.provider, 9)
    if (receipt.payment.reference) field('Payment reference', receipt.payment.reference, 9)
    if (receipt.payment.provider_order_id) field('Provider order reference', receipt.payment.provider_order_id, 9)
  }
  const pages = pdf.getPages()
  pages.forEach((current, index) => {
    current.drawText('Generated from Strativate transaction records. This is a payment receipt.', { x: PAGE.margin, y: 37, size: 7, font, color: MUTED })
    current.drawText(`${index + 1} / ${pages.length}`, { x: PAGE.width - PAGE.margin - 25, y: 24, size: 7, font, color: MUTED })
  })
  return pdf.save()
}
