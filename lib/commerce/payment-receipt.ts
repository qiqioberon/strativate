import type { SalesPayment } from '@/lib/admin/sales-reporting'

export type PaymentReceipt = {
  order_id: string
  invoice: string | null
  currency: 'IDR'
  customer: string | null
  email: string | null
  created_at: string
  paid_at: string | null
  recognized_at: string
  legacy_paid: boolean
  gross: number
  discount: number
  net: number
  discount_code: string | null
  payment: SalesPayment | null
  items: Array<{ id: string; name: string; quantity: number; gross: number; discount: number; net: number }>
}

export function receiptFilename(orderId: string) {
  return `strativate-receipt-${orderId.toLowerCase().replace(/[^a-f0-9-]/g, '')}.pdf`
}

export function receiptEndpoint(orderId: string, download = false) {
  return `/api/orders/${encodeURIComponent(orderId)}/receipt${download ? '?download=1' : ''}`
}
