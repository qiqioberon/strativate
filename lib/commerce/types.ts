import type {
  Cart,
  CartItemView,
  DigitalProduct,
  DigitalProductContentType,
  Order,
  OrderItem,
  OwnedDigitalProduct,
} from '@/lib/supabase/database.types'

export type CommerceItemKind = 'digital_product' | (string & {})

export type PublicDigitalProduct = DigitalProduct & {
  imageUrl: string
  salesCount: number | null
}

export type ResolvedCartItem = CartItemView & {
  imageUrl: string | null
}

export type ActiveCart = Pick<Cart, 'id'> & {
  items: ResolvedCartItem[]
  subtotalAmount: number
  discountAmount: number
  discountCode: string | null
  totalAmount: number
  hasUnavailableItems: boolean
  canCheckout: boolean
}

export type OrderWithItems = Order & {
  items: OrderItem[]
}

export type OwnedDigitalProductView = OwnedDigitalProduct & {
  product_id: string
  imageUrl: string | null
  contentType: DigitalProductContentType | null
  contentReady: boolean
}
