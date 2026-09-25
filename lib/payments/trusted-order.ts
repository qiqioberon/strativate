import type { OrderWithItems } from '@/lib/commerce/types'

export type TrustedMidtransItem = {
  id: string
  price: number
  quantity: 1
  name: string
}

export function buildTrustedMidtransItems(
  order: Pick<OrderWithItems, 'total_amount' | 'items'>,
): TrustedMidtransItem[] {
  if (!Number.isSafeInteger(order.total_amount) || order.total_amount <= 0) {
    throw new Error('Order total is not eligible for Midtrans checkout.')
  }

  const items = order.items.map(item => {
    const trustedPrice = item.discounted_unit_price_amount ?? item.unit_price_amount
    if (!Number.isSafeInteger(trustedPrice) || trustedPrice < 0) {
      throw new Error('Order Item contains an invalid trusted price.')
    }
    return {
      id: item.commerce_item_id,
      price: trustedPrice,
      quantity: 1 as const,
      name: item.name_snapshot,
    }
  })

  const itemTotal = items.reduce((total, item) => total + item.price * item.quantity, 0)
  if (!Number.isSafeInteger(itemTotal) || itemTotal !== order.total_amount) {
    throw new Error('Order Item total does not match Order total.')
  }
  return items
}
