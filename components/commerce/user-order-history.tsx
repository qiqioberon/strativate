'use client'

import { ArrowRight, CreditCard, Eye, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { TablePagination } from '@/components/admin/table-pagination'
import { formatRupiah } from '@/lib/commerce/money'
import { commerceItemLabel, commerceItemName, commerceOrderStatus, type CommerceLanguage } from '@/lib/commerce/presentation'
import type { OrderWithItems } from '@/lib/commerce/types'
import styles from './user-order-history.module.css'

type SortMode='newest'|'oldest'|'total_desc'|'total_asc'

function statusTone(status: OrderWithItems['status']) {
  if (status === 'paid') return 'positive'
  if (status === 'pending_payment') return 'warning'
  return 'danger'
}
function orderReference(order:OrderWithItems){return `#STR-${order.id.slice(0,8).toUpperCase()}`}
function titleFor(order: OrderWithItems, language: CommerceLanguage) {
  const first = order.items[0]?.name_snapshot ? commerceItemName(order.items[0].name_snapshot, language) : null
  if (!first) return language === 'en' ? 'Strativate order' : 'Pesanan Strativate'
  return order.items.length > 1 ? `${first} +${order.items.length - 1} ${language === 'en' ? 'more' : 'item lainnya'}` : first
}

export function UserOrderHistory({
  orders,
  focusOrderId,
  language = 'id',
}: {
  orders: OrderWithItems[]
  focusOrderId?: string | null
  language?: CommerceLanguage
}) {
  const en = language === 'en'
  const text = (english: string, indonesian: string) => en ? english : indonesian
  const locale = en ? 'en-GB' : 'id-ID'
  const statusLabel = (value: OrderWithItems['status']) => commerceOrderStatus(value, language)
  const kindLabel = (value: string) => commerceItemLabel(value, language)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState('all')
  const [kind,setKind]=useState('all')
  const [sort,setSort]=useState<SortMode>('newest')
  const [page,setPage]=useState(0)
  const [pageSize,setPageSize]=useState(10)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const kinds=useMemo(()=>[...new Set(orders.flatMap(order=>order.items.map(item=>item.item_kind_snapshot)))].sort(),[orders])
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('id-ID')
    const result=orders.filter(order=>{
      const matchesQuery=!q||[
        order.id,
        orderReference(order),
        ...order.items.flatMap(item=>[item.name_snapshot,commerceItemName(item.name_snapshot,language),item.slug_snapshot,item.item_kind_snapshot]),
      ].some(value=>String(value??'').toLocaleLowerCase('id-ID').includes(q))
      const matchesStatus=status==='all'||order.status===status
      const matchesKind=kind==='all'||order.items.some(item=>item.item_kind_snapshot===kind)
      return matchesQuery&&matchesStatus&&matchesKind
    })
    return [...result].sort((a,b)=>{
      if(sort==='oldest')return new Date(a.created_at).getTime()-new Date(b.created_at).getTime()
      if(sort==='total_desc')return b.total_amount-a.total_amount
      if(sort==='total_asc')return a.total_amount-b.total_amount
      return new Date(b.created_at).getTime()-new Date(a.created_at).getTime()
    })
  },[kind,language,orders,query,sort,status])

  const safePage=Math.min(page,Math.max(0,Math.ceil(filtered.length/pageSize)-1))
  const visible=filtered.slice(safePage*pageSize,safePage*pageSize+pageSize)
  const selected=useMemo(()=>selectedOrderId?orders.find(order=>order.id===selectedOrderId)??null:null,[orders,selectedOrderId])

  useEffect(()=>{if(selectedOrderId&&!selected)setSelectedOrderId(null)},[selected,selectedOrderId])

  useEffect(()=>{
    if(!focusOrderId)return
    const match=orders.find(order=>order.id===focusOrderId)
    if(match)setSelectedOrderId(match.id)
  },[focusOrderId,orders])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selected && !dialog.open) dialog.showModal()
    if (!selected && dialog.open) dialog.close()
  }, [selected])

  function resetPage(){setPage(0)}

  if (orders.length === 0) return <section className={`workspace-card booking-panel ${en ? styles.empty : ''}`}><h3>{text('No orders yet.', 'Belum ada pesanan.')}</h3><a className="button button-outline" href="/program">{text('Browse programs', 'Lihat Program')} <ArrowRight aria-hidden="true" /></a></section>

  return <>
    <section className={`workspace-card user-order-management ${en ? styles.orders : ''}`}>
      <div className="data-management-toolbar">
        <label className="ops-field ops-field--wide"><span>{text('Search orders', 'Cari pesanan')}</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15}/><input type="search" value={query} onChange={event=>{setQuery(event.target.value);resetPage()}} placeholder={text('Order ID or item name', 'ID pesanan atau nama item')}/></div></label>
        <label className="ops-field"><span>Status</span><select value={status} onChange={event=>{setStatus(event.target.value);resetPage()}}><option value="all">{text('All', 'Semua')}</option><option value="pending_payment">{statusLabel('pending_payment')}</option><option value="paid">{statusLabel('paid')}</option><option value="payment_failed">{statusLabel('payment_failed')}</option><option value="expired">{statusLabel('expired')}</option><option value="cancelled">{statusLabel('cancelled')}</option></select></label>
        <label className="ops-field"><span>{text('Type', 'Jenis')}</span><select value={kind} onChange={event=>{setKind(event.target.value);resetPage()}}><option value="all">{text('All', 'Semua')}</option>{kinds.map(value=><option key={value} value={value}>{kindLabel(value)}</option>)}</select></label>
        <label className="ops-field"><span>{text('Sort', 'Urutkan')}</span><select value={sort} onChange={event=>{setSort(event.target.value as SortMode);resetPage()}}><option value="newest">{text('Newest', 'Terbaru')}</option><option value="oldest">{text('Oldest', 'Terlama')}</option><option value="total_desc">{text('Highest total', 'Total terbesar')}</option><option value="total_asc">{text('Lowest total', 'Total terkecil')}</option></select></label>
        <label className="ops-field"><span>{text('Per page', 'Per halaman')}</span><select value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));resetPage()}}>{[5,10,20,50].map(size=><option value={size} key={size}>{size}</option>)}</select></label>
      </div>
      <div className="data-management-summary"><strong>{filtered.length} {en ? filtered.length === 1 ? 'order' : 'orders' : 'pesanan'}</strong></div>
      <div className="ops-table-wrap"><table className={`ops-table user-order-table ${en ? styles.table : ''}`} data-testid="user-order-table"><thead><tr><th>{text('Order', 'Pesanan')}</th><th>{text('Date', 'Tanggal')}</th><th>{text('Item summary', 'Ringkasan item')}</th><th>{text('Type', 'Jenis')}</th><th>Total</th><th>Status</th><th>{text('Actions', 'Aksi')}</th></tr></thead><tbody>{visible.length?visible.map(order=><tr key={order.id}><td data-label={text('Order', 'Pesanan')}><strong>{orderReference(order)}</strong></td><td data-label={text('Date', 'Tanggal')}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date(order.created_at))}</td><td data-label={text('Item summary', 'Ringkasan item')}><strong>{titleFor(order, language)}</strong><small>{order.items.length} {en && order.items.length !== 1 ? 'items' : 'item'}</small></td><td data-label={text('Type', 'Jenis')}>{[...new Set(order.items.map(item=>kindLabel(item.item_kind_snapshot)))].join(', ')}</td><td data-label="Total">{formatRupiah(order.total_amount)}</td><td data-label="Status"><span className={`ops-status ops-status--${statusTone(order.status)}`}>{statusLabel(order.status)}</span></td><td data-label={text('Actions', 'Aksi')}><div className="table-action-group user-order-action-group"><button type="button" className="button button-outline button-compact user-order-action-button" onClick={()=>setSelectedOrderId(order.id)}><Eye aria-hidden="true" size={15}/>{text('View details', 'Lihat Detail')}</button>{order.status==='pending_payment'?<a className="button button-primary button-compact user-order-action-button" href={`/checkout?order=${encodeURIComponent(order.id)}`}><CreditCard aria-hidden="true" size={15}/>{text('Pay', 'Bayar')}</a>:null}</div></td></tr>):<tr><td colSpan={7}>{text('No orders match these filters.', 'Tidak ada pesanan yang cocok dengan filter.')}</td></tr>}</tbody></table></div>
      <TablePagination language={language} page={safePage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} label={text('Order history pagination', 'Pagination riwayat pesanan')}/>
    </section>

    <dialog ref={dialogRef} className={`ops-dialog ${en ? styles.dialog : ''}`} aria-labelledby="user-order-detail-title" onClose={() => setSelectedOrderId(null)}>
      {selected ? <div className="ops-dialog__surface">
        <header className="ops-dialog__header"><div><p className={en ? styles.dialogLabel : 'kicker'}>{text('Order details', 'Detail pesanan')}</p><h2 id="user-order-detail-title">{orderReference(selected)}</h2><p>{new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(selected.created_at))}</p></div><button type="button" className="ops-icon-button" onClick={() => setSelectedOrderId(null)} aria-label={text('Close order details', 'Tutup detail pesanan')}><X aria-hidden="true" /></button></header>
        <div className="ops-detail-grid"><div><span>{text('Order status', 'Status order')}</span><strong>{statusLabel(selected.status)}</strong></div><div><span>{text('Payment status', 'Status pembayaran')}</span><strong>{selected.status === 'paid' ? text('Verified', 'Terverifikasi') : statusLabel(selected.status)}</strong></div><div><span>{text('Item count', 'Jumlah item')}</span><strong>{selected.items.length}</strong></div><div><span>Total</span><strong>{formatRupiah(selected.total_amount)}</strong></div></div>
        <section className="ops-dialog__section"><h3>{text('Order items', 'Item pesanan')}</h3>{selected.items.map(item => <div className="ops-line-item" key={item.id}><div><strong>{commerceItemName(item.name_snapshot, language)}</strong><span>{kindLabel(item.item_kind_snapshot)} · Qty 1</span></div><div><span>{formatRupiah(item.unit_price_amount)} / item</span><strong>{formatRupiah(item.unit_price_amount)}</strong></div></div>)}</section>
        <div className="ops-total-row"><span>Total</span><strong>{formatRupiah(selected.total_amount)}</strong></div>
        {selected.status === 'pending_payment' ? <a className="button button-primary" href={`/checkout?order=${encodeURIComponent(selected.id)}`}>{text('Continue payment', 'Lanjutkan Pembayaran')} <ArrowRight aria-hidden="true" size={16} /></a> : null}
      </div> : null}
    </dialog>
  </>
}
