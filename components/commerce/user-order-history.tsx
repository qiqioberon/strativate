'use client'

import { ArrowRight, Eye, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { formatRupiah } from '@/lib/commerce/money'
import type { OrderWithItems } from '@/lib/commerce/types'

function statusLabel(status: OrderWithItems['status']) {
  if (status === 'pending_payment') return 'Menunggu pembayaran'
  if (status === 'paid') return 'Lunas'
  if (status === 'payment_failed') return 'Pembayaran gagal'
  if (status === 'expired') return 'Kedaluwarsa'
  return 'Dibatalkan'
}

function statusTone(status: OrderWithItems['status']) {
  if (status === 'paid') return 'positive'
  if (status === 'pending_payment') return 'warning'
  return 'danger'
}

function kindLabel(kind: string) {
  if (kind === 'digital_product') return 'Produk Digital'
  if (kind === 'private_mentoring') return 'Private Mentoring'
  return 'Item'
}

function titleFor(order: OrderWithItems) {
  const first = order.items[0]?.name_snapshot
  if (!first) return 'Pesanan Strativate'
  return order.items.length > 1 ? `${first} +${order.items.length - 1} item lainnya` : first
}

export function UserOrderHistory({ orders }: { orders: OrderWithItems[] }) {
  const [selected, setSelected] = useState<OrderWithItems | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selected && !dialog.open) dialog.showModal()
    if (!selected && dialog.open) dialog.close()
  }, [selected])

  if (orders.length === 0) return <section className="workspace-card booking-panel"><h3>Belum ada pesanan.</h3><p className="panel-copy">Pesanan dari Shared Commerce akan muncul di sini.</p><a className="button button-outline" href="/program">Lihat Program <ArrowRight aria-hidden="true" /></a></section>

  return <>
    <div className="user-order-list">
      {orders.map(order => <article className="workspace-card user-order-card" key={order.id}>
        <div className="user-order-card__main">
          <div><p className="kicker">#STR-{order.id.slice(0, 8).toUpperCase()}</p><h3>{titleFor(order)}</h3><p>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(order.created_at))} · {order.items.length} item</p></div>
          <span className={`ops-status ops-status--${statusTone(order.status)}`}>{statusLabel(order.status)}</span>
        </div>
        <dl className="user-order-card__meta"><div><dt>Total</dt><dd>{formatRupiah(order.total_amount)}</dd></div><div><dt>Pembayaran</dt><dd>{order.status === 'paid' ? 'Terverifikasi' : statusLabel(order.status)}</dd></div><div><dt>Status order</dt><dd>{statusLabel(order.status)}</dd></div></dl>
        <button type="button" className="button button-outline user-order-card__detail" onClick={() => setSelected(order)}><Eye aria-hidden="true" size={16} />Lihat Detail</button>
      </article>)}
    </div>
    <dialog ref={dialogRef} className="ops-dialog" aria-labelledby="user-order-detail-title" onClose={() => setSelected(null)}>
      {selected ? <div className="ops-dialog__surface">
        <header className="ops-dialog__header"><div><p className="kicker">Detail pesanan</p><h2 id="user-order-detail-title">#STR-{selected.id.slice(0, 8).toUpperCase()}</h2><p>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(selected.created_at))}</p></div><button type="button" className="ops-icon-button" onClick={() => setSelected(null)} aria-label="Tutup detail pesanan"><X aria-hidden="true" /></button></header>
        <div className="ops-detail-grid"><div><span>Status order</span><strong>{statusLabel(selected.status)}</strong></div><div><span>Status pembayaran</span><strong>{selected.status === 'paid' ? 'Terverifikasi' : statusLabel(selected.status)}</strong></div><div><span>Jumlah item</span><strong>{selected.items.length}</strong></div><div><span>Total</span><strong>{formatRupiah(selected.total_amount)}</strong></div></div>
        <section className="ops-dialog__section"><h3>Item pesanan</h3>{selected.items.map(item => <div className="ops-line-item" key={item.id}><div><strong>{item.name_snapshot}</strong><span>{kindLabel(item.item_kind_snapshot)} · Qty 1</span></div><div><span>{formatRupiah(item.unit_price_amount)} / item</span><strong>{formatRupiah(item.unit_price_amount)}</strong></div></div>)}</section>
        <div className="ops-total-row"><span>Total</span><strong>{formatRupiah(selected.total_amount)}</strong></div>
        {selected.status === 'pending_payment' ? <a className="button button-primary" href={`/checkout?order=${encodeURIComponent(selected.id)}`}>Lanjutkan Pembayaran <ArrowRight aria-hidden="true" size={16} /></a> : null}
      </div> : null}
    </dialog>
  </>
}
