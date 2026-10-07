import { CartView } from '@/components/commerce/cart-view'
import { getActiveCart } from '@/lib/commerce/server'
import { requireAccount } from '@/lib/auth/server'

export default async function CartPage() {
  const account = await requireAccount('/dashboard')
  const cart = await getActiveCart()
  return (
    <main className="commerce-page">
      <div className="commerce-page__container">
        <CartView cart={cart} language={account.profile.role === 'mentee' ? 'en' : 'id'} />
      </div>
    </main>
  )
}
