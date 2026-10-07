import { formatRupiah } from '@/lib/commerce/money'

export type SalesScope = 'all' | 'digital' | 'private' | 'intensive'
export type SalesComparisonMode = 'none' | 'previous' | 'custom'
export type SalesComparison = { compareMode: SalesComparisonMode; compareFrom: string | null; compareTo: string | null }
export type SalesView = 'summary' | 'analytics' | 'transactions'
export type SalesGranularity = 'auto' | 'day' | 'week' | 'month'
export type SalesMetric = 'net' | 'gross' | 'discount' | 'orders' | 'units'
export type SalesTotals = Record<SalesMetric, number> & { buyers: number; aov: number }
export type SalesBreakdown = SalesTotals & { key: string; label: string; sessions?: number | null; purchased_sessions?: number | null; share?: number }
export type SalesTimePoint = { date: string; total: SalesTotals; categories: Record<string, SalesTotals> }
export type ProductPerformance = {
  key: string; commerce_item_id: string; name: string; kind: string; category: string
  gross: number; discount: number; net: number; units: number; orders: number
  tier: string | null; sessions: number | null; purchase_type: string | null
  competition_scope: string | null; sessions_per_month: number | null
}
export type SalesReport = {
  range: { from: string | null; to: string; previous_from: string | null; previous_to: string | null; granularity: Exclude<SalesGranularity, 'auto'>; compare_mode: SalesComparisonMode; comparison_aligned: boolean }
  totals: SalesTotals; previous: SalesTotals | null
  trend: SalesTimePoint[]; previous_trend: SalesTimePoint[]
  categories: SalesBreakdown[]; products: ProductPerformance[]
  private_tiers: SalesBreakdown[]; private_sessions: SalesBreakdown[]; private_purchase_types: SalesBreakdown[]
  intensive_subtypes: SalesBreakdown[]
  payments: SalesBreakdown[]
  statuses: Array<{ key: string; orders: number; amount: number }>
  discounts: Array<{ code: string; orders: number; gross: number; discount: number; net: number; average_discount: number }>
  discount_orders: number
  customers: { first_time: number; repeat: number; repeat_share: number }
  legacy_paid_orders: number
}
export type LegacySalesReport = Omit<SalesReport, 'range'> & { range: Omit<SalesReport['range'], 'compare_mode' | 'comparison_aligned'> }
export type SalesItem = {
  id: string; commerce_item_id: string; name: string; kind: string; category: string
  quantity: number; gross: number; discount: number; net: number
  tier: string | null; sessions: number | null; purchase_type: string | null
  competition_scope: string | null; sessions_per_month: number | null
}
export type SalesPayment = {
  provider: string; method: string | null; status: string; provider_status: string | null
  reference: string | null; provider_order_id: string | null; updated_at: string
}
export type SalesTransaction = {
  order_id: string; invoice: string | null; user_id: string; customer: string | null; email: string | null
  created_at: string; paid_at: string | null; recognized_at: string | null; status: string
  gross: number; discount: number; net: number; discount_code: string | null
  item_count: number; item_summary: string; items: SalesItem[]; payment: SalesPayment | null
}
export type SalesTransactionPage = { rows: SalesTransaction[]; total_count: number }
export type SalesTransactionFilters = {
  query: string; status: string; payment: string; sort: 'created' | 'paid' | 'net' | 'customer' | 'status' | 'invoice'; direction: 'asc' | 'desc'
}
export const SALES_KINDS: Record<string, string> = {
  digital_product: 'Produk Digital', private_mentoring: 'Private Mentoring',
  intensive_mentoring_package: 'Intensive Mentoring · Paket',
  intensive_mentoring_add_on: 'Intensive Mentoring · Add-on',
  intensive_mentoring_bundle: 'Intensive Mentoring · Bundle',
  intensive_mentoring_custom_offer: 'Intensive Mentoring · Penawaran Internasional',
}
export const CATEGORY_LABELS: Record<string, string> = { total: 'Total', digital: 'Produk Digital', private: 'Private Mentoring', intensive: 'Intensive Mentoring', other: 'Lainnya' }
export const SALES_COLORS: Record<string, string> = { total: '#ed7035', digital: '#4277bc', private: '#8660b1', intensive: '#2c9689', other: '#8a9099', discount: '#c69528', paid: '#348768', pending_payment: '#c69528', payment_failed: '#be5252', cancelled: '#a54c4c', expired: '#8a9099' }
export const STATUS_LABELS: Record<string, string> = { paid: 'Lunas', pending_payment: 'Menunggu pembayaran', payment_failed: 'Pembayaran gagal', expired: 'Kedaluwarsa', cancelled: 'Dibatalkan', creating: 'Menyiapkan pembayaran', pending: 'Menunggu pembayaran', failed: 'Pembayaran gagal' }
export const itemKindLabel = (kind: string) => SALES_KINDS[kind] ?? 'Lainnya'
export const statusLabel = (status: string) => STATUS_LABELS[status] ?? 'Tidak diketahui'
export function paymentMethodLabel(method: string | null | undefined) {
  if (!method || method === 'unknown') return 'Tidak diketahui'
  switch (method) {
    case 'bank_transfer': return 'Bank transfer'
    case 'credit_card': return 'Kartu kredit'
    case 'gopay': return 'GoPay'
    case 'qris': return 'QRIS'
    default: return method.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, value => value.toUpperCase()) || 'Tidak diketahui'
  }
}
export const count = (value: number) => new Intl.NumberFormat('id-ID').format(value)
export const percent = (value: number) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`
export const metricValue = (metric: SalesMetric, value: number) => metric === 'orders' || metric === 'units' ? count(value) : formatRupiah(Math.round(value))
export function jakartaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function shiftDate(date: string, days: number) {
  // Calendar arithmetic on a business date; UTC avoids browser locale/DST changes.
  const value = new Date(`${date}T00:00:00Z`)
  return new Date(value.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}
export function isSalesDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01' || value > '9999-12-30') return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function salesDateRangeError(from: string | null, to: string, comparison = false) {
  const label = comparison ? 'perbandingan' : 'laporan'
  if (from === '' || (comparison && from === null) || !isSalesDate(to) || (from !== null && !isSalesDate(from))) return `Lengkapi tanggal awal dan akhir ${label} yang valid.`
  if (from && from > to) return `Tanggal awal ${label} harus sebelum atau sama dengan tanggal akhir.`
  if (from && (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) >= 600) return `Periode ${label} maksimal 600 bulan. Pilih rentang yang lebih pendek.`
  return ''
}
export function previousSalesRange(from: string, to: string) {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  return { from: shiftDate(from, -days), to: shiftDate(from, -1) }
}
export function displayDate(value: string | null, time = false) {
  if (!value) return '—'
  // A business date is a calendar label, not an instant requiring conversion.
  const dateOnly = value.length === 10
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { timeZone: dateOnly ? 'UTC' : 'Asia/Jakarta', dateStyle: 'medium', ...(time && !dateOnly ? { timeStyle: 'short' as const } : {}) }).format(date)
}
export function comparisonLabel(range: SalesReport['range']) {
  return range.compare_mode === 'custom'
    ? `vs ${displayDate(range.previous_from)} – ${displayDate(range.previous_to)}`
    : 'vs periode sebelumnya'
}
export function comparisonText(current: number, previous: number, context = 'vs periode sebelumnya') {
  if (!previous) return current ? 'Baru pada periode ini' : '—'
  const delta = (current - previous) / previous * 100
  return `${delta > 0 ? '↑ ' : delta < 0 ? '↓ ' : ''}${percent(Math.abs(delta))} ${context}`
}
