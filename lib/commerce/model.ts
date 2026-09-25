import type { CartItemView } from '@/lib/supabase/database.types'
import type { ActiveCart, ResolvedCartItem } from './types'

export function summarizeCart(
  cartId: string,
  rows: CartItemView[],
  imageUrlForPath: (path: string) => string = path => path,
  pricing?: { subtotalAmount: number; discountAmount: number; discountCode: string | null },
): ActiveCart {
  const items: ResolvedCartItem[] = rows.map(row => ({
    ...row,
    imageUrl: row.image_path ? imageUrlForPath(row.image_path) : null,
  }))
  const hasUnavailableItems = items.some(item => !item.is_available)
  const totalAmount = items.reduce((sum, item) => sum + (item.price_amount ?? 0), 0)

  return {
    id: cartId,
    items,
    subtotalAmount: pricing?.subtotalAmount ?? totalAmount,
    discountAmount: pricing?.discountAmount ?? 0,
    discountCode: pricing?.discountCode ?? null,
    totalAmount: pricing ? Math.max(0, pricing.subtotalAmount - pricing.discountAmount) : totalAmount,
    hasUnavailableItems,
    canCheckout: items.length > 0 && !hasUnavailableItems,
  }
}
