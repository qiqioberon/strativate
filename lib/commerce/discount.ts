export type DiscountType = 'percentage' | 'fixed'

export function normalizeDiscountCode(value: string) {
  return value.trim().toUpperCase()
}

export function calculateDiscountAmount(input: { subtotal: number; type: DiscountType; value: number }) {
  const subtotal = Math.max(0, Math.floor(input.subtotal))
  const value = Math.max(0, Math.floor(input.value))
  const raw = input.type === 'percentage' ? Math.floor(subtotal * Math.min(value, 100) / 100) : value
  return Math.min(subtotal, raw)
}

export function resolveDiscountedTotal(subtotal: number, discount: number) {
  const safeSubtotal = Math.max(0, Math.floor(subtotal))
  const safeDiscount = Math.min(safeSubtotal, Math.max(0, Math.floor(discount)))
  return { subtotal: safeSubtotal, discount: safeDiscount, total: safeSubtotal - safeDiscount }
}
