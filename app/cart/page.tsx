import { redirect } from 'next/navigation'

import { CartView } from '@/components/commerce/cart-view'
import { getActiveCart } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'

export default async function CartPage() {
  if (!isDigitalProductsEnabled()) redirect('/dashboard')
  const cart = await getActiveCart()
  return (
    <main className="commerce-page">
      <div className="commerce-page__container">
        <CartView cart={cart} />
      </div>
    </main>
  )
}
