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

function itemKindLabel(kind: string) {
  if (kind === 'digital_product') return 'Produk Digital'
  if (kind === 'private_mentoring') return 'Private Mentoring'
  return 'Item'
}

export function CartView({ cart, embedded = false }: { cart: ActiveCart; embedded?: boolean }) {
  const router = useRouter()
  const { show } = useToast()
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function removeItem(cartItemId: string) {
    if (removingId) return
    const item = cart.items.find(candidate => candidate.cart_item_id === cartItemId)
    setRemovingId(cartItemId)
    const supabase = createClient()
    const { error } = await supabase.rpc('remove_cart_item', { p_cart_item_id: cartItemId })
    if (error) {
      show({ variant: 'error', message: 'Item belum dapat dihapus. Coba lagi.' })
      setRemovingId(null)
      return
    }
    show({ variant: 'success', message: `${item?.name ?? 'Item'} dihapus dari keranjang.` })
    setRemovingId(null)
    router.refresh()
  }

  if (cart.items.length === 0) {
    return (
      <section className={cn('commerce-empty-state', embedded && 'commerce-empty-state--embedded')}>
        <ShoppingBag aria-hidden="true" size={30} />
        <h1>Keranjangmu masih kosong.</h1>
        <p>Item yang kamu pilih melalui website atau Cart Link akan tampil di sini sebelum checkout.</p>
        <div className="button-row">
          <Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program">Lihat Program <ArrowRight aria-hidden="true" size={16} /></Link>
          <Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/produk-digital">Produk Digital</Link>
        </div>
      </section>
    )
  }

  return (
    <div className={cn('commerce-cart-layout', embedded && 'commerce-cart-layout--embedded')}>
      <section className="commerce-cart-items" aria-label="Isi keranjang">
        <div className="commerce-cart-heading"><div><p>Shared Commerce</p><h1>Keranjang</h1></div><span>{cart.items.length} item</span></div>
        {cart.items.map(item => {
          const unavailable = !item.is_available || item.name === null || item.price_amount === null
          return (
            <article className={`commerce-cart-item${unavailable ? ' is-unavailable' : ''}`} key={item.cart_item_id}>
              <div className="commerce-cart-item__cover">
                {item.imageUrl ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.imageUrl} alt="" /></> : <span aria-hidden="true">S</span>}
              </div>
              <div className="commerce-cart-item__content">
                <span>{itemKindLabel(item.item_kind)}</span>
                <h2>{item.name ?? 'Item tidak tersedia'}</h2>
                {item.item_kind === 'digital_product' && item.slug ? <Link href={`/produk-digital/${item.slug}`}>Lihat detail</Link> : null}
                {unavailable ? <p className="commerce-cart-item__warning"><AlertTriangle aria-hidden="true" size={14} /> Item ini sudah tidak tersedia. Hapus item untuk melanjutkan checkout.</p> : null}
              </div>
              <div className="commerce-cart-item__actions">
                <strong>{item.price_amount === null ? 'Tidak tersedia' : formatRupiah(item.price_amount)}</strong>
                <button type="button" onClick={() => removeItem(item.cart_item_id)} disabled={removingId === item.cart_item_id}><Trash2 aria-hidden="true" size={15} /> {removingId === item.cart_item_id ? 'Menghapus…' : 'Hapus'}</button>
              </div>
            </article>
          )
        })}
      </section>
      <aside className="commerce-cart-summary">
        <span>Ringkasan</span>
        <div><p>Total</p><strong>{formatRupiah(cart.totalAmount)}</strong></div>
        <p>Harga checkout dihitung kembali oleh server dari Commerce Item yang masih tersedia.</p>
        {cart.hasUnavailableItems ? <button className={buttonVariants({ variant: 'primary', size: 'marketing' })} type="button" disabled>Checkout tidak tersedia</button> : <form action={checkoutActiveCart}><button className={buttonVariants({ variant: 'primary', size: 'marketing' })} type="submit">Checkout <ArrowRight aria-hidden="true" size={16} /></button></form>}
      </aside>
    </div>
  )
}
