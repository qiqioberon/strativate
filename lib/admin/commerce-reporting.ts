export type AdminCommerceItem = {
  id: string
  commerceItemId: string
  kind: string
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
  createdAt: string
}

export type AdminPaymentSummary = {
  id: string
  provider: string
  providerOrderId: string
  providerTransactionId: string | null
  providerStatus: string | null
  fraudStatus: string | null
  paymentType: string | null
  grossAmount: number
  status: string
  createdAt: string
  updatedAt: string
} | null

export type AdminCommerceOrder = {
  total_count: number
  order_id: string
  user_id: string
  user_email: string
  created_at: string
  paid_at: string | null
  order_status: string
  total_amount: number
  item_count: number
  item_summary: string
  items: AdminCommerceItem[]
  payment: AdminPaymentSummary
}

export type AdminCommerceReport = {
  total_revenue: number
  total_transactions: number
  paid_orders: number
  pending_orders: number
  customer_count: number
  average_order_value: number
  total_users: number
  total_mentors: number
  total_sessions: number
  sessions_today: number
  pending_sessions: number
  trend: Array<{ date: string; revenue: number; transactions: number }>
  product_distribution: Array<{ kind: string; quantity: number }>
  best_sellers: Array<{ name: string; kind: string; quantity: number; revenue: number }>
}

export const commerceCsvFields = [
  ['user', 'User'],
  ['email', 'Email'],
  ['orderId', 'Order ID'],
  ['product', 'Product'],
  ['type', 'Jenis produk'],
  ['quantity', 'Quantity'],
  ['unitPrice', 'Harga'],
  ['total', 'Total'],
  ['paymentStatus', 'Payment status'],
  ['orderStatus', 'Order status'],
  ['date', 'Tanggal'],
] as const

export type CommerceCsvField = typeof commerceCsvFields[number][0]

export function humanOrderTitle(names: string[]) {
  const first = names.find(Boolean)
  if (!first) return 'Pesanan Strativate'
  return names.length > 1 ? `${first} +${names.length - 1} item lainnya` : first
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export function buildCommerceCsv(orders: AdminCommerceOrder[], fields: CommerceCsvField[]) {
  const selected = commerceCsvFields.filter(([key]) => fields.includes(key))
  const header = selected.map(([, label]) => csvCell(label)).join(',')
  const rows = orders.flatMap(order => {
    const items = order.items.length ? order.items : [null]
    return items.map(item => {
      const values: Record<CommerceCsvField, unknown> = {
        user: order.user_email,
        email: order.user_email,
        orderId: order.order_id,
        product: item?.name ?? '',
        type: item?.kind ?? '',
        quantity: item?.quantity ?? 0,
        unitPrice: item?.unitPrice ?? 0,
        total: order.total_amount,
        paymentStatus: order.payment?.status ?? (order.order_status === 'paid' ? 'paid' : 'unavailable'),
        orderStatus: order.order_status,
        date: order.created_at,
      }
      return selected.map(([key]) => csvCell(values[key])).join(',')
    })
  })
  return `\uFEFF${[header, ...rows].join('\r\n')}`
}
