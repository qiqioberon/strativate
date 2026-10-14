import type { DiscountCategory } from '@/lib/supabase/database.types'

export type DiscountFilters = {
  from: string | null
  to: string
  codeId: string | null
  campaign: string
  partner: string
  category: DiscountCategory | 'all'
}
export type DiscountTotals = { redemptions: number; customers: number; discount: number; gross: number; net: number; legacy_paid: number }
export type DiscountPerformance = DiscountTotals & {
  code_id: string; code: string; description: string | null; campaign: string | null
  partner: string | null; trusted_partner_id: string | null; categories: DiscountCategory[]
  scope: string; first_at: string | null; latest_at: string | null
}
export type DiscountTrend = { date: string; redemptions: number; customers: number; discount: number; gross: number; net: number }
export type DiscountReport = {
  summary: DiscountTotals; trend: DiscountTrend[]; granularity: 'day' | 'week' | 'month'
  most_used: Array<{ code_id: string; code: string; redemptions: number }>
  rows: DiscountPerformance[]; total_count: number
}
export type DiscountUsage = {
  order_id: string; user_id: string; code_id: string; code: string
  campaign: string | null; partner: string | null; invoice: string | null
  customer: string | null; email: string | null; institution: string | null
  referral: string | null; purchased_at: string; legacy_paid: boolean
  gross: number; discount: number; net: number; categories: DiscountCategory[]
  products: Array<{ id: string; name: string; kind: string }>
}
export type DiscountUsagePage = { rows: DiscountUsage[]; total_count: number }
export type DiscountExport = DiscountUsagePage & { summary: DiscountTotals; item_count: number }
export type DiscountRpcFilters = {
  p_from: string | null; p_to: string; p_code_id: string | null
  p_campaign: string; p_partner: string; p_category: string
}

export const DISCOUNT_CATEGORY_LABELS: Record<DiscountCategory, string> = {
  digital_products: 'Digital Products', private_mentoring: 'Private Mentoring', intensive_mentoring: 'Intensive Mentoring',
}
export const DISCOUNT_EXPORT_LIMITS = { orders: 25_000, items: 100_000, bytes: 32 * 1024 * 1024 } as const
export const DISCOUNT_EXPORT_LIMIT_MESSAGE = 'Exports include all matching paid redemptions, up to 25,000 orders, 100,000 purchased items and a 32 MB file. Narrow the date range or filters for larger reports.'
export function discountRpcFilters(filters: DiscountFilters): DiscountRpcFilters {
  return { p_from: filters.from, p_to: filters.to, p_code_id: filters.codeId, p_campaign: filters.campaign.trim(), p_partner: filters.partner.trim(), p_category: filters.category }
}
export function discountTransactionHref(orderId: string) {
  return `/admin?${new URLSearchParams({ reportView: 'transactions', reportRange: 'all', reportCompareMode: 'none', reportOrder: orderId })}`
}
