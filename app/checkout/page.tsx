import { CheckCircle2, LockKeyhole } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ContextBackButton } from '@/components/commerce/context-back-button'
import { MidtransEmbed } from '@/components/commerce/midtrans-embed'
import { buttonVariants } from '@/components/ui/button'
import { requireAccount } from '@/lib/auth/server'
import { formatRupiah } from '@/lib/commerce/money'
import { commerceItemLabel, commerceItemName, commerceOrderStatus } from '@/lib/commerce/presentation'
import { getOrderWithItems } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'
import { getMidtransPublicConfig } from '@/lib/payments/midtrans'
import styles from './checkout-mentee.module.css'

async function loadOwnedOrder(orderId: string) {
  try {
    return await getOrderWithItems(orderId)
  } catch {
    notFound()
  }
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ order?: string | string[] }> }) {
  if (!isDigitalProductsEnabled()) redirect('/dashboard')
  const account = await requireAccount('/dashboard')
  const language = account.profile.role === 'mentee' ? 'en' : 'id'
  const text = (english: string, indonesian: string) => language === 'en' ? english : indonesian
  const params = await searchParams
  const requestedOrderId = typeof params.order === 'string' ? params.order : null
  if (!requestedOrderId) return redirect('/cart')

  const order = await loadOwnedOrder(requestedOrderId)
  const midtrans = getMidtransPublicConfig()
  const displayName = [account.profile.first_name, account.profile.last_name].filter(Boolean).join(' ') || text('Strativate mentee', 'Mentee Strativate')

  return (
    <main className={`checkout-page ${language === 'en' ? styles.page : ''}`}>
      <div className="checkout-page__container">
        <ContextBackButton fallbackHref="/cart" label={text('Back', 'Kembali')} />
        <header className="checkout-header">
          <div><h1>Checkout</h1></div>
          <div className="checkout-header__status"><LockKeyhole aria-hidden="true" size={16} /><span>{commerceOrderStatus(order.status, language)}</span></div>
        </header>
        <div className="checkout-grid">
          <div className="checkout-main">
            <section className="checkout-order" aria-labelledby="order-heading">
              <div className="checkout-section-heading"><h2 id="order-heading">{text('Order summary', 'Ringkasan item')}</h2></div>
              <div className="checkout-order__items">
                {order.items.map(item => <article key={item.id}><div><span>{commerceItemLabel(item.item_kind_snapshot, language)}</span><h3>{commerceItemName(item.name_snapshot, language)}</h3></div><strong>{formatRupiah(item.unit_price_amount)}</strong></article>)}
              </div>
              <div className="checkout-order__pricing">
                <div><span>Subtotal</span><strong>{formatRupiah(order.subtotal_amount)}</strong></div>
                {order.discount_amount > 0 ? <div className="checkout-order__discount"><span>{text('Discount', 'Diskon')} {order.discount_code_snapshot ? <em title={order.discount_code_snapshot}>({order.discount_code_snapshot})</em> : null}</span><strong>-{formatRupiah(order.discount_amount)}</strong></div> : null}
                <div className="checkout-order__total"><span>Total</span><strong>{formatRupiah(order.total_amount)}</strong></div>
              </div>
            </section>
            {order.status === 'paid' ? <section className="checkout-paid-state"><CheckCircle2 aria-hidden="true" size={28} /><h2>{text('Payment successful.', 'Pembayaran berhasil.')}</h2><p>{text('Your purchase is available in your dashboard.', 'Produk atau mentoring yang dibeli sudah tersedia pada dashboard akunmu.')}</p><Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/dashboard">{text('Open dashboard', 'Buka Dashboard')}</Link></section> : <MidtransEmbed language={language} orderId={order.id} clientKey={midtrans.clientKey} snapScriptUrl={midtrans.snapScriptUrl} />}
          </div>
          <aside className="checkout-customer"><span>{text('Customer', 'Pelanggan')}</span><strong>{displayName}</strong><p>{account.user.email ?? text('Account email unavailable', 'Email akun tidak tersedia')}</p><dl><div><dt>Order</dt><dd>{order.id}</dd></div><div><dt>Status</dt><dd>{commerceOrderStatus(order.status, language)}</dd></div></dl></aside>
        </div>
      </div>
    </main>
  )
}
