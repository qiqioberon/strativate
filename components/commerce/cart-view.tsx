'use client'

import { AlertTriangle, ArrowRight, Loader2, ShoppingBag, Tag, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'

import { checkoutActiveCart } from '@/app/cart/actions'
import { buttonVariants } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast-provider'
import { formatRupiah } from '@/lib/commerce/money'
import type { ActiveCart } from '@/lib/commerce/types'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ContextBackButton } from './context-back-button'

function CheckoutButton() {
  const { pending } = useFormStatus()
  return (
    <button className={buttonVariants({ variant: 'primary', size: 'marketing' })} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <><Loader2 className="spin" aria-hidden="true" size={16} />Menyiapkan checkout…</> : <>Checkout <ArrowRight aria-hidden="true" size={16} /></>}
    </button>
  )
}

function itemKindLabel(kind: string) {
  if (kind === 'digital_product') return 'Produk Digital'
  if (kind === 'private_mentoring') return 'Private Mentoring'
  if (kind === 'intensive_mentoring_custom_offer') return 'Penawaran Intensive Internasional'
  if (kind.startsWith('intensive_mentoring_')) return 'Intensive Mentoring'
  return 'Item'
}

export function CartView({ cart, embedded = false, onBack }: { cart: ActiveCart; embedded?: boolean; onBack?: () => void }) {
  const router = useRouter()
  const { show } = useToast()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [discountCode, setDiscountCode] = useState(cart.discountCode ?? '')
  const [discountBusy, setDiscountBusy] = useState(false)
  const [discountMessage, setDiscountMessage] = useState('')

  async function applyDiscount() {
    if (!discountCode.trim() || discountBusy) return
    setDiscountBusy(true)
    setDiscountMessage('')
    const { error } = await createClient().rpc('apply_discount_code', { p_cart_id: cart.id, p_code: discountCode })
    if (error) setDiscountMessage(error.message || 'This discount code is not available.')
    else { setDiscountMessage('Discount applied.'); router.refresh() }
    setDiscountBusy(false)
  }

  async function removeDiscount() {
    if (discountBusy) return
    setDiscountBusy(true)
    await createClient().rpc('remove_discount_code', { p_cart_id: cart.id })
    setDiscountCode('')
    setDiscountMessage('Discount removed.')
    router.refresh()
    setDiscountBusy(false)
  }

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

  const back = <ContextBackButton fallbackHref="/dashboard" onBack={onBack} />

  if (cart.items.length === 0) {
    return (
      <div className={cn('commerce-cart-screen', embedded && 'commerce-cart-screen--embedded')}>
        {back}
        <section className={cn('commerce-empty-state', embedded && 'commerce-empty-state--embedded')}>
          <ShoppingBag aria-hidden="true" size={30} />
          <h1>Keranjangmu masih kosong.</h1>
          <p>Item yang kamu pilih melalui website atau Cart Link akan tampil di sini sebelum checkout.</p>
          <div className="button-row commerce-empty-actions">
            <Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program">Lihat Program <ArrowRight aria-hidden="true" size={16} /></Link>
            <Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/produk-digital">Produk Digital</Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={cn('commerce-cart-screen', embedded && 'commerce-cart-screen--embedded')}>
      {back}
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
          <div><p>Subtotal</p><strong>{formatRupiah(cart.subtotalAmount)}</strong></div>
          {cart.discountAmount > 0 ? <div className="commerce-cart-summary__discount"><p>Discount {cart.discountCode ? `(${cart.discountCode})` : ''}</p><strong>-{formatRupiah(cart.discountAmount)}</strong></div> : null}
          <div><p>Total</p><strong>{formatRupiah(cart.totalAmount)}</strong></div>
          <div className="commerce-discount-form"><label htmlFor="discount-code"><Tag aria-hidden="true" size={16} /><span className="sr-only">Discount code</span></label><input id="discount-code" value={discountCode} onChange={event => setDiscountCode(event.target.value)} placeholder="Discount code" disabled={discountBusy} /><button className="button button-outline button-compact" type="button" onClick={() => void (cart.discountCode ? removeDiscount() : applyDiscount())} disabled={discountBusy || (!cart.discountCode && !discountCode.trim())}>{cart.discountCode ? 'Remove' : 'Apply'}</button></div>
          {discountMessage ? <p className="commerce-discount-message" role="status">{discountMessage}</p> : null}
          <p>Checkout is recalculated on the server from available Commerce Items and the applied discount.</p>
          {cart.hasUnavailableItems ? <button className={buttonVariants({ variant: 'primary', size: 'marketing' })} type="button" disabled>Checkout tidak tersedia</button> : <form action={checkoutActiveCart}><CheckoutButton /></form>}
        </aside>
      </div>
    </div>
  )
}
