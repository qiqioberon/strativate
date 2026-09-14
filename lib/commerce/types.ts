import type {
  Cart,
  CartItemView,
  DigitalProduct,
  Order,
  OrderItem,
  OwnedDigitalProduct,
} from '@/lib/supabase/database.types'

export type CommerceItemKind = 'digital_product' | (string & {})

export type PublicDigitalProduct = DigitalProduct & {
  imageUrl: string
}

export type ResolvedCartItem = CartItemView & {
  imageUrl: string | null
}

export type ActiveCart = Pick<Cart, 'id'> & {
  items: ResolvedCartItem[]
  totalAmount: number
  hasUnavailableItems: boolean
  canCheckout: boolean
}

export type OrderWithItems = Order & {
  items: OrderItem[]
}

export type OwnedDigitalProductView = OwnedDigitalProduct & {
  imageUrl: string | null
}
