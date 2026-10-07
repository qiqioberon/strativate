import { formatRupiah } from '@/lib/commerce/money'

export type SalesScope = 'all' | 'digital' | 'private' | 'intensive'
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
  range: { from: string | null; to: string; previous_from: string | null; previous_to: string | null; granularity: Exclude<SalesGranularity, 'auto'> }
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
export const count = (value: number) => new Intl.NumberFormat('id-ID').format(value)
export const percent = (value: number) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`
export const metricValue = (metric: SalesMetric, value: number) => metric === 'orders' || metric === 'units' ? count(value) : formatRupiah(Math.round(value))
export function jakartaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00+07:00`)
  return jakartaDate(new Date(value.getTime() + days * 86_400_000))
}
export function displayDate(value: string | null, time = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', ...(time ? { timeStyle: 'short' as const } : {}) }).format(new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value))
}
export function comparisonText(current: number, previous: number) {
  if (!previous) return current ? 'Baru pada periode ini' : '—'
  const delta = (current - previous) / previous * 100
  return `${delta > 0 ? '↑ ' : delta < 0 ? '↓ ' : ''}${percent(Math.abs(delta))} vs sebelumnya`
}
