import { CheckCircle2, LockKeyhole } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ContextBackButton } from '@/components/commerce/context-back-button'
import { MidtransEmbed } from '@/components/commerce/midtrans-embed'
import { buttonVariants } from '@/components/ui/button'
import { requireAccount } from '@/lib/auth/server'
import { formatRupiah } from '@/lib/commerce/money'
import { getOrderWithItems } from '@/lib/commerce/server'
import type { OrderWithItems } from '@/lib/commerce/types'
import { isDigitalProductsEnabled } from '@/lib/features'
import { getMidtransPublicConfig } from '@/lib/payments/midtrans'

function statusLabel(status: OrderWithItems['status']) {
  switch (status) {
    case 'paid': return 'Lunas'
    case 'payment_failed': return 'Pembayaran gagal'
    case 'expired': return 'Kedaluwarsa'
    case 'cancelled': return 'Dibatalkan'
    default: return 'Menunggu pembayaran'
  }
}

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
  const params = await searchParams
  const requestedOrderId = typeof params.order === 'string' ? params.order : null
  if (!requestedOrderId) return redirect('/cart')

  const order = await loadOwnedOrder(requestedOrderId)
  const midtrans = getMidtransPublicConfig()
  const displayName = [account.profile.first_name, account.profile.last_name].filter(Boolean).join(' ') || 'Mentee Strativate'

  return (
    <main className="checkout-page">
      <div className="checkout-page__container">
        <ContextBackButton fallbackHref="/cart" />
        <header className="checkout-header">
          <div><p>Shared Commerce</p><h1>Checkout</h1></div>
          <div className="checkout-header__status"><LockKeyhole aria-hidden="true" size={16} /><span>{statusLabel(order.status)}</span></div>
        </header>
        <div className="checkout-grid">
          <div className="checkout-main">
            <section className="checkout-order" aria-labelledby="order-heading">
              <div className="checkout-section-heading"><span>Pesanan</span><h2 id="order-heading">Ringkasan item</h2></div>
              <div className="checkout-order__items">
                {order.items.map(item => <article key={item.id}><div><span>{item.item_kind_snapshot === 'digital_product' ? 'Produk Digital' : item.item_kind_snapshot === 'private_mentoring' ? 'Private Mentoring' : 'Item'}</span><h3>{item.name_snapshot}</h3></div><strong>{formatRupiah(item.unit_price_amount)}</strong></article>)}
              </div>
              <div className="checkout-order__total"><span>Total</span><strong>{formatRupiah(order.total_amount)}</strong></div>
            </section>
            {order.status === 'paid' ? <section className="checkout-paid-state"><CheckCircle2 aria-hidden="true" size={28} /><h2>Pembayaran sudah terverifikasi.</h2><p>Produk atau sesi yang dibeli sudah tercatat pada dashboard akunmu.</p><Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/dashboard">Buka Dashboard</Link></section> : <MidtransEmbed orderId={order.id} clientKey={midtrans.clientKey} snapScriptUrl={midtrans.snapScriptUrl} />}
          </div>
          <aside className="checkout-customer"><span>Pelanggan</span><strong>{displayName}</strong><p>{account.user.email ?? 'Email akun tidak tersedia'}</p><dl><div><dt>Order</dt><dd>{order.id}</dd></div><div><dt>Status</dt><dd>{statusLabel(order.status)}</dd></div></dl></aside>
        </div>
      </div>
    </main>
  )
}
