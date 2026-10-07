import {
  CATEGORY_LABELS,
  itemKindLabel,
  statusLabel,
  type SalesComparison,
  type SalesItem,
  type SalesScope,
  type SalesTransaction,
  type SalesTransactionFilters,
} from '@/lib/admin/sales-reporting'

export type SalesExportDataset = 'orders' | 'items' | 'both'
export type SalesExportField = {
  key: string
  label: string
  group: string
  datasets: Array<'orders' | 'items'>
  type?: 'money' | 'number' | 'date'
  width?: number
}
export type SalesExportRequest = SalesComparison & {
  format: 'xlsx' | 'csv'
  dataset: SalesExportDataset
  from: string | null
  to: string | null
  scope: SalesScope
  columns: string[]
  filters: SalesTransactionFilters
}
export type SalesExportValue = string | number | Date | null

// Shared with the client column picker. Spreadsheet dependencies stay in the route.
export const SALES_EXPORT_FIELDS: SalesExportField[] = [
  { key: 'invoice', label: 'Nomor invoice', group: 'Identitas', datasets: ['orders', 'items'], width: 29 },
  { key: 'order_id', label: 'Order ID', group: 'Identitas', datasets: ['orders', 'items'], width: 38 },
  { key: 'customer', label: 'Nama pembeli', group: 'Identitas', datasets: ['orders', 'items'], width: 26 },
  { key: 'email', label: 'Email pembeli', group: 'Identitas', datasets: ['orders', 'items'], width: 32 },
  { key: 'item_summary', label: 'Ringkasan item', group: 'Item & Mentoring', datasets: ['orders'], width: 48 },
  { key: 'item_id', label: 'Order item ID', group: 'Item & Mentoring', datasets: ['items'], width: 38 },
  { key: 'commerce_item_id', label: 'Produk ID', group: 'Item & Mentoring', datasets: ['items'], width: 38 },
  { key: 'item_name', label: 'Nama produk', group: 'Item & Mentoring', datasets: ['items'], width: 42 },
  { key: 'category', label: 'Kategori', group: 'Item & Mentoring', datasets: ['items'], width: 25 },
  { key: 'item_kind', label: 'Jenis produk (kode)', group: 'Item & Mentoring', datasets: ['items'], width: 38 },
  { key: 'item_subtype', label: 'Jenis produk', group: 'Item & Mentoring', datasets: ['items'], width: 38 },
  { key: 'quantity', label: 'Jumlah unit', group: 'Item & Mentoring', datasets: ['items'], type: 'number' },
  { key: 'tier', label: 'Tier mentor', group: 'Item & Mentoring', datasets: ['items'], width: 24 },
  { key: 'sessions', label: 'Jumlah sesi', group: 'Item & Mentoring', datasets: ['items'], type: 'number' },
  { key: 'purchase_type', label: 'Jenis pembelian mentoring', group: 'Item & Mentoring', datasets: ['items'], width: 28 },
  { key: 'competition_scope', label: 'Cakupan kompetisi', group: 'Item & Mentoring', datasets: ['items'], width: 30 },
  { key: 'sessions_per_month', label: 'Sesi per bulan', group: 'Item & Mentoring', datasets: ['items'], type: 'number' },
  { key: 'subtotal', label: 'Subtotal order (IDR)', group: 'Keuangan', datasets: ['orders'], type: 'money', width: 23 },
  { key: 'discount_amount', label: 'Diskon order (IDR)', group: 'Keuangan', datasets: ['orders'], type: 'money', width: 23 },
  { key: 'net_total', label: 'Total bersih order (IDR)', group: 'Keuangan', datasets: ['orders'], type: 'money', width: 27 },
  { key: 'unit_gross', label: 'Harga asli per unit (IDR)', group: 'Keuangan', datasets: ['items'], type: 'money', width: 27 },
  { key: 'unit_net', label: 'Harga bersih per unit (IDR)', group: 'Keuangan', datasets: ['items'], type: 'money', width: 29 },
  { key: 'item_gross', label: 'Subtotal item (IDR)', group: 'Keuangan', datasets: ['items'], type: 'money', width: 23 },
  { key: 'item_discount', label: 'Diskon item (IDR)', group: 'Keuangan', datasets: ['items'], type: 'money', width: 23 },
  { key: 'item_net', label: 'Total bersih item (IDR)', group: 'Keuangan', datasets: ['items'], type: 'money', width: 26 },
  { key: 'discount_code', label: 'Kode diskon', group: 'Keuangan', datasets: ['orders', 'items'], width: 26 },
  { key: 'payment_method', label: 'Metode pembayaran', group: 'Pembayaran', datasets: ['orders', 'items'], width: 25 },
  { key: 'payment_status', label: 'Status pembayaran', group: 'Pembayaran', datasets: ['orders', 'items'], width: 24 },
  { key: 'provider', label: 'Penyedia pembayaran', group: 'Pembayaran', datasets: ['orders', 'items'], width: 25 },
  { key: 'provider_status', label: 'Status provider', group: 'Pembayaran', datasets: ['orders', 'items'], width: 23 },
  { key: 'provider_reference', label: 'Referensi transaksi provider', group: 'Pembayaran', datasets: ['orders', 'items'], width: 38 },
  { key: 'provider_order_id', label: 'Order ID provider', group: 'Pembayaran', datasets: ['orders', 'items'], width: 38 },
  { key: 'order_status', label: 'Status order', group: 'Pembayaran', datasets: ['orders', 'items'], width: 24 },
  { key: 'created_at', label: 'Order dibuat (WIB)', group: 'Waktu', datasets: ['orders', 'items'], type: 'date', width: 25 },
  { key: 'paid_at', label: 'Dibayar (WIB)', group: 'Waktu', datasets: ['orders', 'items'], type: 'date', width: 25 },
  { key: 'recognized_at', label: 'Pengakuan pendapatan (WIB)', group: 'Waktu', datasets: ['orders', 'items'], type: 'date', width: 30 },
]

export const SALES_EXPORT_DEFAULT_COLUMNS: string[] = [
  'invoice', 'order_id', 'customer', 'email', 'item_summary',
  'item_name', 'category', 'item_kind', 'item_subtype', 'quantity', 'tier', 'sessions',
  'subtotal', 'discount_amount', 'net_total', 'item_gross', 'item_discount', 'item_net',
  'discount_code', 'payment_method', 'order_status', 'created_at', 'paid_at',
]

export function salesExportFields(columns: string[], dataset: 'orders' | 'items') {
  return SALES_EXPORT_FIELDS.filter(field => columns.includes(field.key) && field.datasets.includes(dataset))
}

export function sanitizeSalesExportText(value: string) {
  // Remove XML-invalid controls first, then check the effective first character.
  // Leading spaces, tabs and line breaks must not hide a spreadsheet formula.
  const text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\uFFFE\uFFFF]/g, '')
  return /^[\s\uFEFF]*[=+\-@]/u.test(text) ? `'${text}` : text
}

export function salesExportDate(value: string | null) {
  if (!value) return null
  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid export date')
  // Excel serial dates have no timezone. Store the Jakarta wall clock explicitly.
  return new Date(instant.getTime() + 7 * 60 * 60 * 1000)
}

export function salesExportItemMatchesScope(item: SalesItem, scope: SalesScope) {
  return scope === 'all' || item.category === scope
}

export function salesExportValues(order: SalesTransaction, fields: SalesExportField[], item?: SalesItem): SalesExportValue[] {
  const values: Record<string, SalesExportValue> = {
    invoice: order.invoice,
    order_id: order.order_id,
    customer: order.customer,
    email: order.email,
    item_summary: order.item_summary,
    discount_code: order.discount_code,
    order_status: statusLabel(order.status),
    payment_method: order.payment?.method ?? null,
    payment_status: order.payment ? statusLabel(order.payment.status) : null,
    provider: order.payment?.provider ?? null,
    provider_status: order.payment?.provider_status ?? null,
    provider_reference: order.payment?.reference ?? null,
    provider_order_id: order.payment?.provider_order_id ?? null,
    created_at: salesExportDate(order.created_at),
    paid_at: salesExportDate(order.paid_at),
    recognized_at: salesExportDate(order.recognized_at),
  }
  if (item) {
    Object.assign(values, {
      item_id: item.id,
      commerce_item_id: item.commerce_item_id,
      item_name: item.name,
      category: CATEGORY_LABELS[item.category] ?? 'Lainnya',
      item_kind: item.kind,
      item_subtype: itemKindLabel(item.kind),
      quantity: item.quantity,
      tier: item.tier,
      sessions: item.sessions,
      purchase_type: item.purchase_type,
      competition_scope: item.competition_scope,
      sessions_per_month: item.sessions_per_month,
      unit_gross: item.quantity > 0 ? item.gross / item.quantity : null,
      unit_net: item.quantity > 0 ? item.net / item.quantity : null,
      item_gross: item.gross,
      item_discount: item.discount,
      item_net: item.net,
    })
  } else {
    // Order amounts never enter the item-row mapping, even if called incorrectly.
    Object.assign(values, { subtotal: order.gross, discount_amount: order.discount, net_total: order.net })
  }
  return fields.map(field => {
    const value = values[field.key] ?? null
    if (typeof value === 'string') return sanitizeSalesExportText(value)
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid export number')
    return value
  })
}

export function salesExportCsvRow(values: SalesExportValue[]) {
  return values.map(value => {
    const text = value instanceof Date
      ? `${value.toISOString().slice(0, 19).replace('T', ' ')}+07:00`
      : typeof value === 'string' ? sanitizeSalesExportText(value) : String(value ?? '')
    return `"${text.replaceAll('"', '""')}"`
  }).join(',') + '\r\n'
}
