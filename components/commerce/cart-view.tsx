'use client'

import { AlertTriangle, ArrowRight, ShoppingBag, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { checkoutActiveCart } from '@/app/cart/actions'
import { buttonVariants } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast-provider'
import { formatRupiah } from '@/lib/commerce/money'
import type { ActiveCart } from '@/lib/commerce/types'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function CartView({ cart, embedded = false }: { cart: ActiveCart; embedded?: boolean }) {
  const router = useRouter()
  const { show } = useToast()
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function removeItem(cartItemId: string) {
    if (removingId) return
    setRemovingId(cartItemId)
    const supabase = createClient()
    const { error } = await supabase.rpc('remove_cart_item', { p_cart_item_id: cartItemId })
    if (error) {
      show({ variant: 'error', message: 'Item belum dapat dihapus. Coba lagi.' })
      setRemovingId(null)
      return
    }
    show({ variant: 'success', message: 'Produk dihapus dari keranjang.' })
    setRemovingId(null)
    router.refresh()
  }

  if (cart.items.length === 0) {
    return (
      <section className={cn('commerce-empty-state', embedded && 'commerce-empty-state--embedded')}>
        <ShoppingBag aria-hidden="true" size={30} />
        <h1>Keranjang Anda masih kosong.</h1>
        <p>Tambahkan Produk Digital yang ingin Anda beli, lalu kembali ke sini untuk checkout.</p>
        <Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/produk-digital">
          Lihat Produk Digital <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </section>
    )
  }

  return (
    <div className={cn('commerce-cart-layout', embedded && 'commerce-cart-layout--embedded')}>
      <section className="commerce-cart-items" aria-label="Isi keranjang">
        <div className="commerce-cart-heading">
          <div>
            <p>Produk Digital</p>
            <h1>Keranjang</h1>
          </div>
          <span>{cart.items.length} item</span>
        </div>

        {cart.items.map((item) => {
          const unavailable = !item.is_available || item.name === null || item.price_amount === null
          return (
            <article className={`commerce-cart-item${unavailable ? ' is-unavailable' : ''}`} key={item.cart_item_id}>
              <div className="commerce-cart-item__cover">
                {item.imageUrl ? (
                  // Public marketing cover only; paid source content never uses this URL.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" />
                ) : <span aria-hidden="true">S</span>}
              </div>
              <div className="commerce-cart-item__content">
                <span>{item.item_kind === 'digital_product' ? 'Produk Digital' : 'Item'}</span>
                <h2>{item.name ?? 'Item tidak tersedia'}</h2>
                {item.slug ? <Link href={`/produk-digital/${item.slug}`}>Lihat detail</Link> : null}
                {unavailable ? (
                  <p className="commerce-cart-item__warning"><AlertTriangle aria-hidden="true" size={14} /> Item ini sudah tidak tersedia. Hapus item untuk melanjutkan checkout.</p>
                ) : null}
              </div>
              <div className="commerce-cart-item__actions">
                <strong>{item.price_amount === null ? 'Tidak tersedia' : formatRupiah(item.price_amount)}</strong>
                <button type="button" onClick={() => removeItem(item.cart_item_id)} disabled={removingId === item.cart_item_id}>
                  <Trash2 aria-hidden="true" size={15} /> {removingId === item.cart_item_id ? 'Menghapus…' : 'Hapus'}
                </button>
              </div>
            </article>
          )
        })}
      </section>

      <aside className="commerce-cart-summary">
        <span>Ringkasan</span>
        <div><p>Total</p><strong>{formatRupiah(cart.totalAmount)}</strong></div>
        <p>Harga checkout dihitung kembali oleh server dari Commerce Item yang masih tersedia.</p>
        {cart.hasUnavailableItems ? (
          <button className={buttonVariants({ variant: 'primary', size: 'marketing' })} type="button" disabled>
            Checkout tidak tersedia
          </button>
        ) : (
          <form action={checkoutActiveCart}>
            <button className={buttonVariants({ variant: 'primary', size: 'marketing' })} type="submit">
              Checkout <ArrowRight aria-hidden="true" size={16} />
            </button>
          </form>
        )}
      </aside>
    </div>
  )
}
