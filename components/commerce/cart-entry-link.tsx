import { ShoppingCart } from 'lucide-react'
import Link from 'next/link'

export function CartEntryLink({ showCart }: { showCart: boolean }) {
  if (!showCart) return null
  return (
    <Link className="marketing-cart-link" href="/cart" aria-label="Buka keranjang">
      <ShoppingCart aria-hidden="true" size={17} />
      <span>Keranjang</span>
    </Link>
  )
}
