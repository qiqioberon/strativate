'use client'

import { AlertTriangle, ArrowRight, BookOpen, Loader2, ShoppingBag, Tag, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'

import { checkoutActiveCart } from '@/app/cart/actions'
import { buttonVariants } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast-provider'
import { formatRupiah } from '@/lib/commerce/money'
import { commerceDiscountError, commerceItemLabel, commerceItemName, type CommerceLanguage } from '@/lib/commerce/presentation'
import type { ActiveCart } from '@/lib/commerce/types'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ContextBackButton } from './context-back-button'
import styles from './cart-view.module.css'

function CheckoutButton({ language }: { language: CommerceLanguage }) {
  const { pending } = useFormStatus()
  return (
    <button className={buttonVariants({ variant: 'primary', size: 'marketing' })} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <><Loader2 className="spin" aria-hidden="true" size={16} />{language === 'en' ? 'Preparing checkout…' : 'Menyiapkan checkout…'}</> : <>Checkout <ArrowRight aria-hidden="true" size={16} /></>}
    </button>
  )
}

export function CartView({ cart, embedded = false, onBack, language = 'id' }: { cart: ActiveCart; embedded?: boolean; onBack?: () => void; language?: CommerceLanguage }) {
  const en = language === 'en'
  const text = (english: string, indonesian: string) => en ? english : indonesian
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
    if (error) setDiscountMessage(commerceDiscountError(error.message, language))
    else { setDiscountMessage(text('Discount code applied.', 'Kode diskon berhasil digunakan.')); router.refresh() }
    setDiscountBusy(false)
  }

  async function removeDiscount() {
    if (discountBusy) return
    setDiscountBusy(true)
    const { error } = await createClient().rpc('remove_discount_code', { p_cart_id: cart.id })
    if (error) {
      setDiscountMessage(text('The discount code could not be removed. Try again.', 'Kode diskon belum dapat dihapus. Coba lagi.'))
      setDiscountBusy(false)
      return
    }
    setDiscountCode('')
    setDiscountMessage(text('Discount code removed.', 'Kode diskon dihapus.'))
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
      show({ variant: 'error', message: text('The item could not be removed. Try again.', 'Item belum dapat dihapus. Coba lagi.') })
      setRemovingId(null)
      return
    }
    show({ variant: 'success', message: en ? `${commerceItemName(item?.name ?? 'Item', language)} removed from your cart.` : `${item?.name ?? 'Item'} dihapus dari keranjang.` })
    setRemovingId(null)
    router.refresh()
  }

  const back = <ContextBackButton fallbackHref="/dashboard" onBack={onBack} label={text('Back', 'Kembali')} />

  if (cart.items.length === 0) {
    return (
      <div className={cn(en && styles.screen, 'commerce-cart-screen', en && embedded && styles.embedded, embedded && 'commerce-cart-screen--embedded')}>
        {back}
        <section className={cn('commerce-empty-state', embedded && 'commerce-empty-state--embedded')}>
          <ShoppingBag aria-hidden="true" size={30} />
          <h1>{text('Your cart is empty.', 'Keranjangmu masih kosong.')}</h1>
          <p>{text('Items you add from the website or a Cart Link will appear here before checkout.', 'Item yang kamu pilih melalui website atau Cart Link akan tampil di sini sebelum checkout.')}</p>
          <div className="button-row commerce-empty-actions">
            <Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program">{text('Browse programs', 'Lihat Program')} <ArrowRight aria-hidden="true" size={16} /></Link>
            <Link className={cn(buttonVariants({ variant: 'outline', size: 'marketing' }), en && styles.secondaryAction)} href="/produk-digital"><BookOpen aria-hidden="true" size={16} />{text('Digital products', 'Produk Digital')}</Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={cn(en && styles.screen, 'commerce-cart-screen', en && embedded && styles.embedded, embedded && 'commerce-cart-screen--embedded')}>
      {back}
      <div className={cn('commerce-cart-layout', embedded && 'commerce-cart-layout--embedded')}>
        <section className="commerce-cart-items" aria-label={text('Cart items', 'Isi keranjang')}>
          <div className="commerce-cart-heading"><div><h1>{text('Cart', 'Keranjang')}</h1></div><span>{cart.items.length} {en && cart.items.length !== 1 ? 'items' : 'item'}</span></div>
          {cart.items.map(item => {
            const unavailable = !item.is_available || item.name === null || item.price_amount === null
            return (
              <article className={`commerce-cart-item${unavailable ? ' is-unavailable' : ''}`} key={item.cart_item_id}>
                <div className="commerce-cart-item__cover">
                  {item.imageUrl ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.imageUrl} alt="" /></> : <span aria-hidden="true">S</span>}
                </div>
                <div className="commerce-cart-item__content">
                  <span>{commerceItemLabel(item.item_kind, language)}</span>
                  <h2>{item.name ? commerceItemName(item.name, language) : text('Item unavailable', 'Item tidak tersedia')}</h2>
                  {item.item_kind === 'digital_product' && item.slug ? <Link href={`/produk-digital/${item.slug}`}>{text('View details', 'Lihat detail')}</Link> : null}
                  {unavailable ? <p className="commerce-cart-item__warning"><AlertTriangle aria-hidden="true" size={14} /> {text('This item is unavailable. Remove it to continue to checkout.', 'Item ini sudah tidak tersedia. Hapus item untuk melanjutkan checkout.')}</p> : null}
                </div>
                <div className="commerce-cart-item__actions">
                  <div className="commerce-cart-item__price">{item.item_kind === 'digital_product' && item.reference_price_amount != null ? <del>{formatRupiah(item.reference_price_amount)}</del> : null}<strong>{item.price_amount === null ? text('Unavailable', 'Tidak tersedia') : formatRupiah(item.price_amount)}</strong></div>
                  <button type="button" onClick={() => removeItem(item.cart_item_id)} disabled={removingId === item.cart_item_id}><Trash2 aria-hidden="true" size={15} /> {removingId === item.cart_item_id ? text('Removing…', 'Menghapus…') : text('Remove', 'Hapus')}</button>
                </div>
              </article>
            )
          })}
        </section>
        <aside className="commerce-cart-summary">
          <span>{text('Summary', 'Ringkasan')}</span>
          <div className="commerce-cart-summary__row"><p>Subtotal</p><strong>{formatRupiah(cart.subtotalAmount)}</strong></div>
          {cart.discountAmount > 0 ? <div className="commerce-cart-summary__row commerce-cart-summary__discount"><p>{text('Discount', 'Diskon')} {cart.discountCode ? <span title={cart.discountCode}>({cart.discountCode})</span> : null}</p><strong>-{formatRupiah(cart.discountAmount)}</strong></div> : null}
          <div className="commerce-cart-summary__row commerce-cart-summary__total"><p>Total</p><strong>{formatRupiah(cart.totalAmount)}</strong></div>
          <div className="commerce-discount-form"><label htmlFor="discount-code"><Tag aria-hidden="true" size={16} /><span className="sr-only">{text('Discount code', 'Kode diskon')}</span></label><input id="discount-code" maxLength={64} value={discountCode} onChange={event => setDiscountCode(event.target.value)} placeholder={text('Discount code', 'Kode diskon')} disabled={discountBusy || Boolean(cart.discountCode)} /><button className="button button-outline button-compact" type="button" onClick={() => void (cart.discountCode ? removeDiscount() : applyDiscount())} disabled={discountBusy || (!cart.discountCode && !discountCode.trim())}>{cart.discountCode ? text('Remove', 'Hapus') : text('Apply', 'Terapkan')}</button></div>
          {discountMessage ? <p className="commerce-discount-message" role="status">{discountMessage}</p> : null}
          {!en ? <p className="commerce-discount-help">Masukkan kode promo untuk melihat potongan yang berlaku.</p> : null}
          {cart.hasUnavailableItems ? <button className={buttonVariants({ variant: 'primary', size: 'marketing' })} type="button" disabled>{text('Checkout unavailable', 'Checkout tidak tersedia')}</button> : <form action={checkoutActiveCart}><CheckoutButton language={language} /></form>}
        </aside>
      </div>
    </div>
  )
}
