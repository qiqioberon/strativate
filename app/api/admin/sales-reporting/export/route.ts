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
import { CATEGORY_LABELS, isSalesDate, jakartaDate, previousSalesRange, salesDateRangeError, statusLabel, type SalesReport, type SalesTransaction } from '@/lib/admin/sales-reporting'
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
const LIMIT_MESSAGE = 'Ekspor dibatasi 50.000 order, 100.000 item, dan file 64 MB. Persempit periode atau filter transaksi lalu coba lagi.'
type ExportSnapshot = { report: SalesReport; rows: SalesTransaction[]; total_count: number; item_count: number }

class ExportError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function allowKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new ExportError('Parameter ekspor tidak dikenali.')
}

function dateParameter(value: unknown) {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ExportError('Tanggal harus menggunakan format YYYY-MM-DD.')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value.startsWith('0000') || value > '9999-12-30') {
    throw new ExportError('Tanggal ekspor tidak valid.')
  }
  return value
}

function choice<T extends string>(value: unknown, choices: readonly T[], message: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new ExportError(message)
  return value as T
}

async function readRequest(request: Request): Promise<SalesExportRequest> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ExportError('Permintaan ekspor harus berupa JSON.', 415)
  }
  const reader = request.body?.getReader()
  if (!reader) throw new ExportError('Pengaturan ekspor belum lengkap.')
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel()
        throw new ExportError('Pengaturan ekspor terlalu besar.', 413)
      }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  let body: unknown
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ExportError('Pengaturan ekspor tidak valid.') }
  if (!record(body)) throw new ExportError('Pengaturan ekspor tidak valid.')
  allowKeys(body, ['format', 'dataset', 'from', 'to', 'scope', 'compareMode', 'compareFrom', 'compareTo', 'columns', 'filters'])
  const format = choice(body.format, ['xlsx', 'csv'], 'Pilih format Excel atau CSV.')
  const dataset = choice(body.dataset, ['orders', 'items', 'both'], 'Dataset ekspor tidak valid.')
  if (format === 'csv' && dataset === 'both') throw new ExportError('CSV harus berisi satu dataset: Orders atau Items.')
  const from = dateParameter(body.from)
  // Capture the inclusive Jakarta end date once; the entire export uses this bound.
  const to = dateParameter(body.to) ?? jakartaDate()
  const rangeError = salesDateRangeError(from, to)
  if (rangeError) throw new ExportError(rangeError)
  const scope = choice(body.scope, ['all', 'digital', 'private', 'intensive'], 'Kategori laporan tidak valid.')
  const compareMode = choice(body.compareMode, ['none', 'previous', 'custom'], 'Pengaturan perbandingan tidak valid.')
  const compareFrom = dateParameter(body.compareFrom)
  const compareTo = dateParameter(body.compareTo)
  if (!from && compareMode !== 'none') throw new ExportError('Pilih periode dengan tanggal awal untuk menggunakan perbandingan.')
  if (compareMode === 'custom') {
    if (!compareFrom || !compareTo) throw new ExportError('Lengkapi tanggal awal dan akhir perbandingan.')
    const comparisonError = salesDateRangeError(compareFrom, compareTo, true)
    if (comparisonError) throw new ExportError(comparisonError)
  } else if (compareFrom !== null || compareTo !== null) {
    throw new ExportError('Tanggal perbandingan hanya tersedia untuk rentang kustom.')
  }
  if (from && compareMode === 'previous') {
    const previous = previousSalesRange(from, to)
    if (!isSalesDate(previous.from)) throw new ExportError('Periode sebelumnya berada di luar tanggal yang didukung. Pilih perbandingan kustom atau tanpa perbandingan.')
  }
  if (!Array.isArray(body.columns) || !body.columns.length || body.columns.length > SALES_EXPORT_FIELDS.length ||
    body.columns.some(column => typeof column !== 'string' || !SALES_EXPORT_FIELDS.some(field => field.key === column))) {
    throw new ExportError('Pilih kolom ekspor yang tersedia.')
  }
  const columns = body.columns as string[]
  if (new Set(columns).size !== columns.length) throw new ExportError('Kolom ekspor tidak boleh berulang.')
  const datasets: Array<'orders' | 'items'> = dataset === 'both' ? ['orders', 'items'] : [dataset]
  if (datasets.some(selected => !salesExportFields(columns, selected).length) ||
    columns.some(key => !SALES_EXPORT_FIELDS.find(field => field.key === key)?.datasets.some(selected => datasets.includes(selected)))) {
    throw new ExportError('Kolom yang dipilih tidak sesuai dengan dataset ekspor.')
  }
  if (!record(body.filters)) throw new ExportError('Filter transaksi belum lengkap.')
  allowKeys(body.filters, ['query', 'status', 'payment', 'sort', 'direction'])
  const { query } = body.filters
  const payment = body.filters.payment === '' ? 'all' : body.filters.payment
  const status = body.filters.status === '' ? 'all' : body.filters.status
  if (typeof query !== 'string' || query.length > 200 || /[\u0000-\u001f]/u.test(query)) throw new ExportError('Pencarian transaksi maksimal 200 karakter.')
  // Payment methods are provider-defined values from the report, not SQL identifiers.
  if (typeof payment !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(payment)) throw new ExportError('Metode pembayaran tidak valid.')
  return {
    format, dataset, from, to, scope, compareMode, compareFrom, compareTo, columns,
    filters: {
      query,
      payment,
      status: choice(status, ['all', 'paid', 'pending_payment', 'payment_failed', 'expired', 'cancelled'], 'Status order tidak valid.'),
      sort: choice(body.filters.sort, ['created', 'paid', 'net', 'customer', 'status', 'invoice'], 'Urutan transaksi tidak valid.'),
      direction: choice(body.filters.direction, ['asc', 'desc'], 'Arah urutan transaksi tidak valid.'),
    },
  }
}

function safeCell(value: SalesExportValue): SalesExportValue {
  if (typeof value !== 'string') return value
  const text = sanitizeSalesExportText(value)
  if (text.length > 32_767) throw new ExportError('Ada teks yang melebihi batas sel Excel (32.767 karakter). Hubungi pengelola data.', 422)
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
  const sheet = workbook.addWorksheet('Ringkasan', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [{ width: 42 }, { width: 38 }, { width: 25 }, { width: 25 }, { width: 22 }, { width: 22 }]
  const heading = sheet.addRow(['Laporan Penjualan Strativate'])
  styleHeader(heading)
  heading.commit()
  const range = snapshot.report.range
  const comparison = snapshot.report.previous
  const comparisonLabels = { none: 'Tidak dibandingkan', previous: 'Periode sebelumnya', custom: 'Rentang kustom' }
  const info: Array<[string, SalesExportValue]> = [
    ['Dibuat (Asia/Jakarta)', salesExportDate(generated.toISOString())],
    ['Periode utama dari (inklusif)', range.from ?? 'Semua waktu'], ['Periode utama sampai (inklusif)', range.to],
    ['Mode perbandingan', comparisonLabels[range.compare_mode]],
    ...(comparison ? [
      ['Perbandingan dari (inklusif)', range.previous_from],
      ['Perbandingan sampai (inklusif)', range.previous_to],
    ] as Array<[string, SalesExportValue]> : []),
    ['Kategori', options.scope === 'all' ? 'Semua penjualan' : CATEGORY_LABELS[options.scope]],
    ['Pencarian transaksi', options.filters.query || 'Semua'],
    ['Status transaksi', options.filters.status === 'all' ? 'Semua' : statusLabel(options.filters.status)],
    ['Metode pembayaran transaksi', options.filters.payment === 'all' ? 'Semua' : options.filters.payment],
    ['Urutan transaksi', `${options.filters.sort} (${options.filters.direction})`],
    ['Order dalam ekspor', snapshot.total_count],
    ['Item sesuai kategori dalam ekspor', snapshot.rows.reduce((sum, order) => sum + order.items.filter(item => salesExportItemMatchesScope(item, options.scope)).length, 0)],
    ['Metodologi KPI', 'Order lunas berdasarkan paid_at dalam Asia/Jakarta; fallback legacy menggunakan recognized_at.'],
    ['Cakupan KPI', 'KPI memakai periode dan kategori laporan. Pencarian, status, dan metode pembayaran hanya memfilter sheet transaksi.'],
    ['Periode transaksi ekspor', 'Orders dan Items hanya memakai periode utama. Perbandingan hanya ditampilkan pada metadata dan KPI Ringkasan.'],
    ['Cakupan Orders', 'Satu baris per order. Nilai order utuh, termasuk item kategori lain pada order campuran.'],
    ['Cakupan Items', 'Satu baris per item sesuai kategori terpilih. Nilai keuangan hanya milik item; total order tidak diulang.'],
    ['Pengakuan pendapatan', 'Nilai transaksi belum lunas bukan pendapatan yang diakui. Waktu pengakuan legacy tersedia pada kolom opsional.'],
    ['Order legacy tanpa paid_at', snapshot.report.legacy_paid_orders],
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
    ? ['Metrik laporan', 'Periode utama', range.compare_mode === 'custom' ? 'Perbandingan kustom' : 'Periode sebelumnya', 'Selisih', 'Perubahan']
    : ['Metrik laporan', 'Periode utama'])
  styleHeader(metricHeader)
  metricHeader.commit()
  const metrics = [
    ['Pendapatan bersih (IDR)', 'net', true], ['Penjualan bruto (IDR)', 'gross', true],
    ['Diskon (IDR)', 'discount', true], ['Order lunas', 'orders', false],
    ['Unit terjual', 'units', false], ['Pembeli unik', 'buyers', false], ['Rata-rata order lunas (IDR)', 'aov', true],
  ] as const
  for (const [label, key, money] of metrics) {
    const current = snapshot.report.totals[key]
    const values: SalesExportValue[] = [label, current]
    if (comparison) {
      const previous = comparison[key]
      const change = previous === 0 ? (current === 0 ? 0 : 'Baru pada periode ini') : (current - previous) / previous
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
  const categoryHeader = sheet.addRow(['Kategori penjualan lunas', 'Bruto (IDR)', 'Diskon (IDR)', 'Bersih (IDR)', 'Unit', 'Order lunas'])
  styleHeader(categoryHeader)
  categoryHeader.commit()
  for (const category of snapshot.report.categories) {
    const row = sheet.addRow([safeCell(category.label), category.gross, category.discount, category.net, category.units, category.orders])
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
    if (authError || !auth.user) throw new ExportError('Silakan masuk kembali untuk mengekspor laporan.', 401)
    const { data: admin, error: adminError } = await supabase.rpc('is_admin')
    if (adminError || admin !== true) throw new ExportError('Ekspor laporan hanya tersedia untuk admin.', 403)
    const options = await readRequest(request)
    const { data, error } = await supabase.rpc('get_admin_sales_export_v2', {
      p_from: options.from, p_to: options.to, p_scope: options.scope,
      p_compare_mode: options.compareMode, p_compare_from: options.compareFrom, p_compare_to: options.compareTo,
      p_query: options.filters.query, p_status: options.filters.status, p_payment: options.filters.payment,
      p_sort: options.filters.sort, p_direction: options.filters.direction,
      p_max_orders: MAX_ORDERS, p_max_items: MAX_ITEMS,
    })
    if (error?.code === '54000') throw new ExportError(LIMIT_MESSAGE, 413)
    if (error?.code === '22023') throw new ExportError('Periode atau filter ekspor tidak dapat diproses. Persempit periode lalu coba lagi.')
    if (error) throw new ExportError('Data ekspor belum dapat dimuat. Persempit periode atau coba lagi sebentar.', 503)
    const snapshot = data
    if (!snapshot?.report || !Array.isArray(snapshot.rows) || !Number.isSafeInteger(snapshot.total_count) ||
      snapshot.total_count !== snapshot.rows.length || !Number.isSafeInteger(snapshot.item_count)) {
      throw new ExportError('Data ekspor belum lengkap. Muat ulang laporan lalu coba lagi.', 503)
    }
    const itemCount = snapshot.rows.reduce((sum, order) => sum + order.items.length, 0)
    if (snapshot.total_count > MAX_ORDERS || itemCount > MAX_ITEMS || snapshot.item_count > MAX_ITEMS) throw new ExportError(LIMIT_MESSAGE, 413)
    if (itemCount !== snapshot.item_count) throw new ExportError('Data ekspor belum lengkap. Muat ulang laporan lalu coba lagi.', 503)
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
      { message: error instanceof ExportError ? error.message : 'File ekspor belum dapat disiapkan. Coba lagi sebentar.' },
      { status: error instanceof ExportError ? error.status : 500, headers: PRIVATE_HEADERS },
    )
  }
}
