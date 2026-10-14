import { PassThrough } from 'node:stream'
import ExcelJS from 'exceljs'
import { DISCOUNT_CATEGORY_LABELS, DISCOUNT_EXPORT_LIMITS, DISCOUNT_EXPORT_LIMIT_MESSAGE, discountRpcFilters, type DiscountExport, type DiscountFilters, type DiscountUsage } from '@/lib/admin/discount-reporting'
import { salesExportCsvRow, salesExportDate, sanitizeSalesExportText, type SalesExportValue } from '@/lib/admin/sales-export'
import { isSalesDate, jakartaDate, salesDateRangeError } from '@/lib/admin/sales-reporting'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 300
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }
const MAX_REQUEST_BYTES = 8 * 1024
class ExportError extends Error { constructor(message: string, readonly status = 400) { super(message) } }
type Options = DiscountFilters & { format: 'csv' | 'xlsx' }
const HEADERS = ['Code', 'Campaign (current metadata)', 'Collaboration / partner (current metadata)', 'Customer', 'Email', 'Institution', 'Referral source', 'Invoice', 'Order ID', 'Purchased (WIB)', 'Legacy paid-time fallback', 'Purchased products / programs', 'Applicable categories (current metadata)', 'Gross order value (IDR)', 'Discount (IDR)', 'Net paid order value (IDR)']

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function textParameter(value: unknown) {
  if (typeof value !== 'string' || value.length > 200 || /[\u0000-\u001f\u007f]/u.test(value)) throw new ExportError('Campaign and collaboration filters are limited to 200 characters.')
  return value.trim()
}
async function readOptions(request: Request): Promise<Options> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ExportError('Use a JSON export request.', 415)
  const reader = request.body?.getReader()
  if (!reader) throw new ExportError('Export filters are incomplete.')
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_REQUEST_BYTES) { await reader.cancel(); throw new ExportError('Export settings are too large.', 413) }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  let body: unknown
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ExportError('Invalid export settings.') }
  if (!record(body) || Object.keys(body).some(key => !['format', 'from', 'to', 'codeId', 'campaign', 'partner', 'category'].includes(key))) throw new ExportError('Invalid export settings.')
  if (body.format !== 'csv' && body.format !== 'xlsx') throw new ExportError('Choose CSV or Excel format.')
  if (body.from !== null && (typeof body.from !== 'string' || !isSalesDate(body.from))) throw new ExportError('Invalid start date.')
  const from = body.from as string | null
  if (body.to !== null && (typeof body.to !== 'string' || !isSalesDate(body.to))) throw new ExportError('Invalid end date.')
  const to = (body.to as string | null) ?? jakartaDate()
  const rangeError = salesDateRangeError(from, to)
  if (rangeError) throw new ExportError(rangeError)
  if (body.codeId !== null && (typeof body.codeId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.codeId))) throw new ExportError('Invalid discount code filter.')
  if (typeof body.category !== 'string' || !['all', 'digital_products', 'private_mentoring', 'intensive_mentoring'].includes(body.category)) throw new ExportError('Invalid applicable category.')
  return { format: body.format, from, to, codeId: body.codeId as string | null, campaign: textParameter(body.campaign), partner: textParameter(body.partner), category: body.category as Options['category'] }
}
function safeCell(value: SalesExportValue) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new ExportError('Report amount exceeds the supported integer precision.', 422)
  if (typeof value !== 'string') return value
  const text = sanitizeSalesExportText(value)
  if (text.length > 32_767) throw new ExportError('A report cell exceeds the 32,767-character spreadsheet limit. Narrow the filters or contact the data administrator.', 422)
  return text
}
function values(row: DiscountUsage): SalesExportValue[] {
  return [row.code, row.campaign, row.partner, row.customer, row.email, row.institution ?? 'Unavailable', row.referral ?? 'Unavailable', row.invoice, row.order_id,
    salesExportDate(row.purchased_at), row.legacy_paid ? 'Yes' : 'No', row.products.map(item => item.name).join(' | '),
    row.categories.map(category => DISCOUNT_CATEGORY_LABELS[category]).join(' | ') || 'Unavailable', row.gross, row.discount, row.net]
}
function summary(options: Options, snapshot: DiscountExport): SalesExportValue[][] {
  return [
    ['Strativate Discount Code Usage', 'Internal admin report'],
    ['Generated (WIB)', salesExportDate(new Date().toISOString())],
    ['Start date (inclusive, WIB)', options.from ?? 'All time'], ['End date (inclusive, WIB)', options.to],
    ['Code ID filter', options.codeId ?? 'All'], ['Campaign contains', options.campaign || 'All'], ['Collaboration / partner contains', options.partner || 'All'],
    ['Applicable category', options.category === 'all' ? 'All' : DISCOUNT_CATEGORY_LABELS[options.category]],
    ['Successful redemptions', snapshot.summary.redemptions], ['Distinct customers', snapshot.summary.customers],
    ['Total discount (IDR)', snapshot.summary.discount], ['Gross order value (IDR)', snapshot.summary.gross], ['Net paid order value (IDR)', snapshot.summary.net],
    ['Paid-time fallback orders', snapshot.summary.legacy_paid],
    ['Definition', 'One successful redemption per paid order with a redeemed discount reservation. Distinct customers count unique buyer accounts.'],
    ['Amounts', 'Full order snapshots, including all purchased items; gross uses the existing legacy zero-subtotal fallback. Net is the paid order total.'],
    ['Dates', 'Inclusive Asia/Jakarta dates using paid_at; legacy orders use the shared sales-report paid-time fallback.'],
    ['Attribution', 'Campaign, collaboration and applicable categories are current code metadata. Institution and referral use recorded customer relationships and do not establish partnership.'],
    ['Missing origin', 'Unavailable means no institution or referral relationship was recorded.'],
    ['Limits', DISCOUNT_EXPORT_LIMIT_MESSAGE],
  ]
}
function csv(options: Options, snapshot: DiscountExport) {
  const chunks: Buffer[] = [Buffer.from('\uFEFF', 'utf8')]
  let size = chunks[0].length
  const append = (row: SalesExportValue[]) => {
    const chunk = Buffer.from(salesExportCsvRow(row.map(safeCell)), 'utf8')
    size += chunk.length
    if (size > DISCOUNT_EXPORT_LIMITS.bytes) throw new ExportError(DISCOUNT_EXPORT_LIMIT_MESSAGE, 413)
    chunks.push(chunk)
  }
  summary(options, snapshot).forEach(append)
  append([]); append(HEADERS)
  snapshot.rows.forEach(row => append(values(row)))
  return Buffer.concat(chunks)
}
async function xlsx(options: Options, snapshot: DiscountExport) {
  const output = new PassThrough()
  const chunks: Buffer[] = []
  let bytes = 0
  const completed = new Promise<Buffer>((resolve, reject) => {
    output.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > DISCOUNT_EXPORT_LIMITS.bytes) output.destroy(new ExportError(DISCOUNT_EXPORT_LIMIT_MESSAGE, 413))
      else chunks.push(chunk)
    })
    output.on('end', () => resolve(Buffer.concat(chunks)))
    output.on('error', reject)
  })
  // The error can arrive while rows are being appended, before the final await.
  void completed.catch(() => {})
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output, useStyles: true, useSharedStrings: false })
  workbook.creator = 'Strativate'
  const append = (sheet: ExcelJS.Worksheet, rowValues: SalesExportValue[], heading = false) => {
    const row = sheet.addRow(rowValues.map(safeCell))
    if (heading) {
      row.font = { bold: true, color: { argb: 'FF52341F' } }
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1E5' } }
    }
    row.alignment = { vertical: 'top', wrapText: true }
    row.eachCell(cell => { if (cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy hh:mm:ss' })
    if (sheet.name === 'Usage' && !heading) for (let i = 14; i <= 16; i++) row.getCell(i).numFmt = '"Rp" #,##0'
    row.commit()
  }
  try {
    const info = workbook.addWorksheet('Summary')
    info.columns = [{ width: 36 }, { width: 110 }]
    summary(options, snapshot).forEach((row, index) => append(info, row, index === 0))
    info.commit()
    const sheet = workbook.addWorksheet('Usage', { views: [{ state: 'frozen', ySplit: 1 }] })
    sheet.columns = HEADERS.map((_, index) => ({ width: index === 11 ? 65 : index === 8 ? 38 : 26 }))
    append(sheet, HEADERS, true)
    for (let index = 0; index < snapshot.rows.length; index++) {
      if (output.destroyed) await completed
      append(sheet, values(snapshot.rows[index]))
      if (index % 500 === 0) await new Promise<void>(resolve => setImmediate(resolve))
    }
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: snapshot.rows.length + 1, column: HEADERS.length } }
    sheet.commit()
    const [, buffer] = await Promise.all([workbook.commit(), completed])
    return buffer
  } catch (error) { output.destroy(); throw error }
}
export async function POST(request: Request) {
  try {
    const client = await createClient()
    const { data: auth, error: authError } = await client.auth.getUser()
    if (authError || !auth.user) throw new ExportError('Sign in again to export discount usage.', 401)
    const { data: admin, error: adminError } = await client.rpc('is_admin')
    if (adminError || admin !== true) throw new ExportError('Discount usage exports require an administrator.', 403)
    const options = await readOptions(request)
    const { data: snapshot, error } = await client.rpc('get_admin_discount_export', discountRpcFilters(options))
    if (error?.code === '54000') throw new ExportError(DISCOUNT_EXPORT_LIMIT_MESSAGE, 413)
    if (error?.code === '22023') throw new ExportError('Invalid export dates or filters.')
    if (error || !snapshot) throw new ExportError('Unable to load discount usage. Refresh and try again.', 503)
    if (!Array.isArray(snapshot.rows) || !Number.isSafeInteger(snapshot.total_count) || snapshot.total_count !== snapshot.rows.length || !snapshot.summary || snapshot.summary.redemptions !== snapshot.total_count || !Number.isSafeInteger(snapshot.item_count)) throw new ExportError('The export snapshot is incomplete. Try again.', 503)
    const items = snapshot.rows.reduce((sum, row) => sum + row.products.length, 0)
    if (snapshot.total_count > DISCOUNT_EXPORT_LIMITS.orders || items > DISCOUNT_EXPORT_LIMITS.items) throw new ExportError(DISCOUNT_EXPORT_LIMIT_MESSAGE, 413)
    if (items !== snapshot.item_count) throw new ExportError('The export snapshot is incomplete. Try again.', 503)
    const buffer = options.format === 'csv' ? csv(options, snapshot) : await xlsx(options, snapshot)
    const filename = `strativate-discount-usage-${options.from ?? 'all'}_${options.to}.${options.format}`
    return new Response(new Uint8Array(buffer), { headers: { ...PRIVATE_HEADERS,
      'Content-Type': options.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Length': String(buffer.length),
    } })
  } catch (error) {
    return Response.json({ message: error instanceof ExportError ? error.message : 'Unable to prepare discount usage export. Try again shortly.' },
      { status: error instanceof ExportError ? error.status : 500, headers: PRIVATE_HEADERS })
  }
}
