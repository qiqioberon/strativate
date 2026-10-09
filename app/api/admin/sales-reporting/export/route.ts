import { PassThrough } from 'node:stream'
import ExcelJS, { type Row, type Worksheet } from 'exceljs'
import {
  SALES_EXPORT_FIELDS,
  salesExportCsvRow,
  salesExportDate,
  salesExportFields,
  salesExportItemMatchesScope,
  salesExportValues,
  sanitizeSalesExportText,
  type SalesExportField,
  type SalesExportRequest,
  type SalesExportValue,
} from '@/lib/admin/sales-export'
import { CATEGORY_LABELS, isSalesDate, jakartaDate, paymentMethodLabel, previousSalesRange, salesDateRangeError, statusLabel, type SalesReport, type SalesTransaction } from '@/lib/admin/sales-reporting'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_ORDERS = 50_000
const MAX_ITEMS = 100_000
const MAX_FILE_BYTES = 64 * 1024 * 1024
const MAX_REQUEST_BYTES = 32 * 1024
const MONEY_FORMAT = '"Rp" #,##0;[Red]"Rp" -#,##0'
const DATE_FORMAT = 'dd/mm/yyyy hh:mm:ss'
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }
const LIMIT_MESSAGE = 'Exports are limited to 50,000 orders, 100,000 items and a 64 MB file. Narrow the period or transaction filters and try again.'
type ExportSnapshot = { report: SalesReport; rows: SalesTransaction[]; total_count: number; item_count: number }

class ExportError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function allowKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new ExportError('Unrecognized export parameter.')
}

function dateParameter(value: unknown) {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ExportError('Dates must use the YYYY-MM-DD format.')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value.startsWith('0000') || value > '9999-12-30') {
    throw new ExportError('Invalid export date.')
  }
  return value
}

function choice<T extends string>(value: unknown, choices: readonly T[], message: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new ExportError(message)
  return value as T
}

async function readRequest(request: Request): Promise<SalesExportRequest> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ExportError('Export requests must use JSON.', 415)
  }
  const reader = request.body?.getReader()
  if (!reader) throw new ExportError('Export settings are incomplete.')
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel()
        throw new ExportError('Export settings are too large.', 413)
      }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  let body: unknown
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ExportError('Invalid export settings.') }
  if (!record(body)) throw new ExportError('Invalid export settings.')
  allowKeys(body, ['format', 'dataset', 'from', 'to', 'scope', 'compareMode', 'compareFrom', 'compareTo', 'columns', 'filters'])
  const format = choice(body.format, ['xlsx', 'csv'], 'Choose Excel or CSV format.')
  const dataset = choice(body.dataset, ['orders', 'items', 'both'], 'Invalid export dataset.')
  if (format === 'csv' && dataset === 'both') throw new ExportError('CSV must contain one dataset: Orders or Items.')
  const from = dateParameter(body.from)
  // Capture the inclusive Jakarta end date once; the entire export uses this bound.
  const to = dateParameter(body.to) ?? jakartaDate()
  const rangeError = salesDateRangeError(from, to)
  if (rangeError) throw new ExportError(rangeError)
  const scope = choice(body.scope, ['all', 'digital', 'private', 'intensive'], 'Invalid reporting category.')
  const compareMode = choice(body.compareMode, ['none', 'previous', 'custom'], 'Invalid comparison settings.')
  const compareFrom = dateParameter(body.compareFrom)
  const compareTo = dateParameter(body.compareTo)
  if (!from && compareMode !== 'none') throw new ExportError('Choose a period with a start date to use comparison.')
  if (compareMode === 'custom') {
    if (!compareFrom || !compareTo) throw new ExportError('Enter the comparison start and end dates.')
    const comparisonError = salesDateRangeError(compareFrom, compareTo, true)
    if (comparisonError) throw new ExportError(comparisonError)
  } else if (compareFrom !== null || compareTo !== null) {
    throw new ExportError('Comparison dates are only available for custom ranges.')
  }
  if (from && compareMode === 'previous') {
    const previous = previousSalesRange(from, to)
    if (!isSalesDate(previous.from)) throw new ExportError('The previous period is outside the supported dates. Choose a custom comparison or no comparison.')
  }
  if (!Array.isArray(body.columns) || !body.columns.length || body.columns.length > SALES_EXPORT_FIELDS.length ||
    body.columns.some(column => typeof column !== 'string' || !SALES_EXPORT_FIELDS.some(field => field.key === column))) {
    throw new ExportError('Choose available export columns.')
  }
  const columns = body.columns as string[]
  if (new Set(columns).size !== columns.length) throw new ExportError('Export columns must not be duplicated.')
  const datasets: Array<'orders' | 'items'> = dataset === 'both' ? ['orders', 'items'] : [dataset]
  if (datasets.some(selected => !salesExportFields(columns, selected).length) ||
    columns.some(key => !SALES_EXPORT_FIELDS.find(field => field.key === key)?.datasets.some(selected => datasets.includes(selected)))) {
    throw new ExportError('Selected columns do not match the export dataset.')
  }
  if (!record(body.filters)) throw new ExportError('Transaction filters are incomplete.')
  allowKeys(body.filters, ['query', 'status', 'payment', 'sort', 'direction'])
  const { query } = body.filters
  const payment = body.filters.payment === '' ? 'all' : body.filters.payment
  const status = body.filters.status === '' ? 'all' : body.filters.status
  if (typeof query !== 'string' || query.length > 200 || /[\u0000-\u001f]/u.test(query)) throw new ExportError('Transaction search is limited to 200 characters.')
  // Payment methods are provider-defined values from the report, not SQL identifiers.
  if (typeof payment !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(payment)) throw new ExportError('Invalid payment method.')
  return {
    format, dataset, from, to, scope, compareMode, compareFrom, compareTo, columns,
    filters: {
      query,
      payment,
      status: choice(status, ['all', 'paid', 'pending_payment', 'payment_failed', 'expired', 'cancelled'], 'Invalid order status.'),
      sort: choice(body.filters.sort, ['created', 'paid', 'net', 'customer', 'status', 'invoice'], 'Invalid transaction sort order.'),
      direction: choice(body.filters.direction, ['asc', 'desc'], 'Invalid transaction sort direction.'),
    },
  }
}

function safeCell(value: SalesExportValue): SalesExportValue {
  if (typeof value !== 'string') return value
  const text = sanitizeSalesExportText(value)
  if (text.length > 32_767) throw new ExportError('Text exceeds the Excel cell limit of 32,767 characters. Contact the data administrator.', 422)
  return text
}

function styleHeader(row: Row) {
  row.height = 28
  row.eachCell(cell => {
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF292929' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F1ED' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2DED7' } } }
  })
}

function appendRow(sheet: Worksheet, values: SalesExportValue[], fields?: SalesExportField[]) {
  const row = sheet.addRow(values.map(safeCell))
  fields?.forEach((field, index) => {
    if (field.type === 'money') row.getCell(index + 1).numFmt = MONEY_FORMAT
    if (field.type === 'number') row.getCell(index + 1).numFmt = '#,##0'
    if (field.type === 'date') row.getCell(index + 1).numFmt = DATE_FORMAT
  })
  row.commit()
}

function addSummary(workbook: ExcelJS.stream.xlsx.WorkbookWriter, snapshot: ExportSnapshot, options: SalesExportRequest, generated: Date) {
  const sheet = workbook.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [{ width: 42 }, { width: 38 }, { width: 25 }, { width: 25 }, { width: 22 }, { width: 22 }]
  const heading = sheet.addRow(['Strativate Sales Report'])
  styleHeader(heading)
  heading.commit()
  const range = snapshot.report.range
  const comparison = snapshot.report.previous
  const comparisonLabels = { none: 'No comparison', previous: 'Previous period', custom: 'Custom date range' }
  const info: Array<[string, SalesExportValue]> = [
    ['Generated (Asia/Jakarta)', salesExportDate(generated.toISOString())],
    ['Main period from (inclusive)', range.from ?? 'All time'], ['Main period to (inclusive)', range.to],
    ['Comparison mode', comparisonLabels[range.compare_mode]],
    ...(comparison ? [
      ['Comparison from (inclusive)', range.previous_from],
      ['Comparison to (inclusive)', range.previous_to],
    ] as Array<[string, SalesExportValue]> : []),
    ['Category', options.scope === 'all' ? 'All sales' : CATEGORY_LABELS[options.scope]],
    ['Transaction search', options.filters.query || 'All'],
    ['Transaction status', options.filters.status === 'all' ? 'All' : statusLabel(options.filters.status)],
    ['Transaction payment method', options.filters.payment === 'all' ? 'All' : paymentMethodLabel(options.filters.payment)],
    ['Transaction sort order', `${({ created: 'Created date', paid: 'Payment date', net: 'Net amount', customer: 'Customer', status: 'Status', invoice: 'Invoice' })[options.filters.sort]} (${options.filters.direction === 'asc' ? 'ascending' : 'descending'})`],
    ['Orders in export', snapshot.total_count],
    ['Items in selected category in export', snapshot.rows.reduce((sum, order) => sum + order.items.filter(item => salesExportItemMatchesScope(item, options.scope)).length, 0)],
    ['KPI methodology', 'Paid orders use paid_at in Asia/Jakarta; historical fallback uses recognized_at.'],
    ['KPI coverage', 'KPIs use the reporting period and category. Search, status and payment method filter only the transaction worksheets.'],
    ['Export transaction period', 'Orders and Items use only the main period. Comparison appears only in the Summary metadata and KPIs.'],
    ['Orders coverage', 'One row per order. Full order amounts include other categories in mixed orders.'],
    ['Items coverage', 'One row per item in the selected category. Financial amounts belong to the item; order totals are not repeated.'],
    ['Revenue recognition', 'Unpaid transaction amounts are not recognized revenue. Historical recognition dates are available in an optional column.'],
    ['Historical orders without paid_at', snapshot.report.legacy_paid_orders],
  ]
  for (const [label, value] of info) {
    const row = sheet.addRow([label, safeCell(value)])
    if (value instanceof Date) row.getCell(2).numFmt = DATE_FORMAT
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' }
    if (typeof value === 'string' && value.length > 80) row.height = Math.ceil(value.length / 35) * 15
    row.commit()
  }
  appendRow(sheet, [])
  const metricHeader = sheet.addRow(comparison
    ? ['Report metric', 'Main period', range.compare_mode === 'custom' ? 'Custom comparison' : 'Previous period', 'Difference', 'Change']
    : ['Report metric', 'Main period'])
  styleHeader(metricHeader)
  metricHeader.commit()
  const metrics = [
    ['Net revenue (IDR)', 'net', true], ['Gross sales (IDR)', 'gross', true],
    ['Discounts (IDR)', 'discount', true], ['Paid orders', 'orders', false],
    ['Units sold', 'units', false], ['Unique customers', 'buyers', false], ['Average paid order value (IDR)', 'aov', true],
  ] as const
  for (const [label, key, money] of metrics) {
    const current = snapshot.report.totals[key]
    const values: SalesExportValue[] = [label, current]
    if (comparison) {
      const previous = comparison[key]
      const change = previous === 0 ? (current === 0 ? 0 : 'New in this period') : (current - previous) / previous
      values.push(previous, current - previous, change)
    }
    const row = sheet.addRow(values.map(safeCell))
    for (const index of comparison ? [2, 3, 4] : [2]) row.getCell(index).numFmt = money ? MONEY_FORMAT : '#,##0'
    if (comparison) {
      row.getCell(5).numFmt = '0.0%'
      row.getCell(5).alignment = { wrapText: true, vertical: 'top' }
    }
    row.commit()
  }
  appendRow(sheet, [])
  const categoryHeader = sheet.addRow(['Paid sales category', 'Gross (IDR)', 'Discounts (IDR)', 'Net (IDR)', 'Unit', 'Paid orders'])
  styleHeader(categoryHeader)
  categoryHeader.commit()
  for (const category of snapshot.report.categories) {
    const row = sheet.addRow([safeCell(CATEGORY_LABELS[category.key] ?? 'Other'), category.gross, category.discount, category.net, category.units, category.orders])
    for (const index of [2, 3, 4]) row.getCell(index).numFmt = MONEY_FORMAT
    row.commit()
  }
  sheet.commit()
}

async function* datasetRows(snapshot: ExportSnapshot, options: SalesExportRequest, dataset: 'orders' | 'items', fields: SalesExportField[]) {
  let written = 0
  for (const order of snapshot.rows) {
    if (dataset === 'orders') {
      yield salesExportValues(order, fields)
      written++
    } else {
      for (const item of order.items) {
        if (!salesExportItemMatchesScope(item, options.scope)) continue
        yield salesExportValues(order, fields, item)
        written++
        if (written % 500 === 0) await new Promise<void>(resolve => setImmediate(resolve))
      }
    }
    if (dataset === 'orders' && written % 500 === 0) await new Promise<void>(resolve => setImmediate(resolve))
  }
}

async function createWorkbook(snapshot: ExportSnapshot, options: SalesExportRequest, generated: Date) {
  // Commit rows as they are written; retain the bounded ZIP, not an entire cell model.
  const output = new PassThrough()
  const chunks: Buffer[] = []
  let bytes = 0
  let tooLarge = false
  const completed = new Promise<Buffer>((resolve, reject) => {
    output.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > MAX_FILE_BYTES) tooLarge = true
      else chunks.push(chunk)
    })
    // Discard excess ZIP bytes, then reject the whole file instead of returning a partial export.
    output.once('end', () => tooLarge ? reject(new ExportError(LIMIT_MESSAGE, 413)) : resolve(Buffer.concat(chunks)))
    output.once('error', reject)
  })
  // Register rejection handling immediately, including errors during row generation.
  void completed.catch(() => {})
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output, useStyles: true, useSharedStrings: false })
  workbook.creator = 'Strativate'
  workbook.created = generated
  workbook.modified = generated
  try {
    addSummary(workbook, snapshot, options, generated)
    const datasets: Array<'orders' | 'items'> = options.dataset === 'both' ? ['orders', 'items'] : [options.dataset]
    for (const dataset of datasets) {
      const fields = salesExportFields(options.columns, dataset)
      const sheet = workbook.addWorksheet(dataset === 'orders' ? 'Orders' : 'Items', { views: [{ state: 'frozen', ySplit: 1 }] })
      sheet.columns = fields.map(field => ({ width: field.width ?? 18 }))
      const header = sheet.addRow(fields.map(field => safeCell(field.label)))
      styleHeader(header)
      header.commit()
      let rowCount = 1
      for await (const values of datasetRows(snapshot, options, dataset, fields)) {
        appendRow(sheet, values, fields)
        rowCount++
      }
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rowCount, column: fields.length } }
      sheet.commit()
    }
    const [, buffer] = await Promise.all([workbook.commit(), completed])
    return buffer
  } catch (error) {
    output.destroy()
    throw error
  }
}

async function createCsv(snapshot: ExportSnapshot, options: SalesExportRequest) {
  const dataset = options.dataset as 'orders' | 'items'
  const fields = salesExportFields(options.columns, dataset)
  const chunks = [Buffer.from(`\uFEFF${salesExportCsvRow(fields.map(field => field.label))}`, 'utf8')]
  let bytes = chunks[0].length
  for await (const values of datasetRows(snapshot, options, dataset, fields)) {
    const chunk = Buffer.from(salesExportCsvRow(values.map(safeCell)), 'utf8')
    bytes += chunk.length
    if (bytes > MAX_FILE_BYTES) throw new ExportError(LIMIT_MESSAGE, 413)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) throw new ExportError('Sign in again to export reports.', 401)
    const { data: admin, error: adminError } = await supabase.rpc('is_admin')
    if (adminError || admin !== true) throw new ExportError('Report exports are only available to administrators.', 403)
    const options = await readRequest(request)
    const { data, error } = await supabase.rpc('get_admin_sales_export_v2', {
      p_from: options.from, p_to: options.to, p_scope: options.scope,
      p_compare_mode: options.compareMode, p_compare_from: options.compareFrom, p_compare_to: options.compareTo,
      p_query: options.filters.query, p_status: options.filters.status, p_payment: options.filters.payment,
      p_sort: options.filters.sort, p_direction: options.filters.direction,
      p_max_orders: MAX_ORDERS, p_max_items: MAX_ITEMS,
    })
    if (error?.code === '54000') throw new ExportError(LIMIT_MESSAGE, 413)
    if (error?.code === '22023') throw new ExportError('Unable to process the export period or filters. Narrow the period and try again.')
    if (error) throw new ExportError('Unable to load export data. Narrow the period or try again shortly.', 503)
    const snapshot = data
    if (!snapshot?.report || !Array.isArray(snapshot.rows) || !Number.isSafeInteger(snapshot.total_count) ||
      snapshot.total_count !== snapshot.rows.length || !Number.isSafeInteger(snapshot.item_count)) {
      throw new ExportError('Export data is incomplete. Refresh the report and try again.', 503)
    }
    const itemCount = snapshot.rows.reduce((sum, order) => sum + order.items.length, 0)
    if (snapshot.total_count > MAX_ORDERS || itemCount > MAX_ITEMS || snapshot.item_count > MAX_ITEMS) throw new ExportError(LIMIT_MESSAGE, 413)
    if (itemCount !== snapshot.item_count) throw new ExportError('Export data is incomplete. Refresh the report and try again.', 503)
    const generated = new Date()
    const buffer = options.format === 'xlsx' ? await createWorkbook(snapshot, options, generated) : await createCsv(snapshot, options)
    const prefix = options.format === 'xlsx' ? 'sales' : options.dataset
    const filename = `strativate-${prefix}-${options.from ?? 'all'}_${options.to}.${options.format}`.replace(/[^a-zA-Z0-9._-]/g, '-')
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': options.format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (error) {
    return Response.json(
      { message: error instanceof ExportError ? error.message : 'Unable to prepare the export file. Try again shortly.' },
      { status: error instanceof ExportError ? error.status : 500, headers: PRIVATE_HEADERS },
    )
  }
}
