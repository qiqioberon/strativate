import type { OrderWithItems } from '@/lib/commerce/types'
import type { PaymentAttempt } from '@/lib/supabase/database.types'

export type SanitizedCheckout = {
  order: {
    id: string
    status: OrderWithItems['status']
    currencyCode: 'IDR'
    totalAmount: number
    paidAt: string | null
  }
  items: Array<{
    id: string
    kind: string
    name: string
    slug: string
    unitPriceAmount: number
  }>
  payment: null | {
    attemptId: string
    status: PaymentAttempt['status']
    snapToken: string | null
  }
}
