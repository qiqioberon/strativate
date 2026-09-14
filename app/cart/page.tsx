import { CartView } from '@/components/commerce/cart-view'
import { getActiveCart } from '@/lib/commerce/server'

export default async function CartPage() {
  const cart = await getActiveCart()
  return (
    <main className="commerce-page">
      <div className="commerce-page__container">
        <CartView cart={cart} />
      </div>
    </main>
  )
}
