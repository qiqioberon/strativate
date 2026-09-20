'use client'

import { ArrowRight, Eye, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { TablePagination } from '@/components/admin/table-pagination'
import { formatRupiah } from '@/lib/commerce/money'
import type { OrderWithItems } from '@/lib/commerce/types'

type SortMode='newest'|'oldest'|'total_desc'|'total_asc'

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
  if (kind === 'intensive_mentoring_custom_offer') return 'Penawaran Intensive Internasional'
  if (kind.startsWith('intensive_mentoring_') || kind === 'intensive_mentoring') return 'Intensive Mentoring'
  return kind.replaceAll('_',' ')
}
function orderReference(order:OrderWithItems){return `#STR-${order.id.slice(0,8).toUpperCase()}`}
function titleFor(order: OrderWithItems) {
  const first = order.items[0]?.name_snapshot
  if (!first) return 'Pesanan Strativate'
  return order.items.length > 1 ? `${first} +${order.items.length - 1} item lainnya` : first
}

export function UserOrderHistory({
  orders,
  focusOrderId,
}: {
  orders: OrderWithItems[]
  focusOrderId?: string | null
}) {
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
        ...order.items.flatMap(item=>[item.name_snapshot,item.slug_snapshot,item.item_kind_snapshot]),
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
  },[kind,orders,query,sort,status])

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

  if (orders.length === 0) return <section className="workspace-card booking-panel"><h3>Belum ada pesanan.</h3><p className="panel-copy">Pesanan dari Shared Commerce akan muncul di sini.</p><a className="button button-outline" href="/program">Lihat Program <ArrowRight aria-hidden="true" /></a></section>

  return <>
    <section className="workspace-card user-order-management">
      <div className="data-management-toolbar">
        <label className="ops-field ops-field--wide"><span>Cari pesanan</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15}/><input type="search" value={query} onChange={event=>{setQuery(event.target.value);resetPage()}} placeholder="ID pesanan atau nama item"/></div></label>
        <label className="ops-field"><span>Status</span><select value={status} onChange={event=>{setStatus(event.target.value);resetPage()}}><option value="all">Semua</option><option value="pending_payment">Menunggu pembayaran</option><option value="paid">Lunas</option><option value="payment_failed">Pembayaran gagal</option><option value="expired">Kedaluwarsa</option><option value="cancelled">Dibatalkan</option></select></label>
        <label className="ops-field"><span>Jenis</span><select value={kind} onChange={event=>{setKind(event.target.value);resetPage()}}><option value="all">Semua</option>{kinds.map(value=><option key={value} value={value}>{kindLabel(value)}</option>)}</select></label>
        <label className="ops-field"><span>Urutkan</span><select value={sort} onChange={event=>{setSort(event.target.value as SortMode);resetPage()}}><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="total_desc">Total terbesar</option><option value="total_asc">Total terkecil</option></select></label>
        <label className="ops-field"><span>Per halaman</span><select value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));resetPage()}}>{[5,10,20,50].map(size=><option value={size} key={size}>{size}</option>)}</select></label>
      </div>
      <div className="data-management-summary"><strong>{filtered.length} pesanan</strong><span>Filter bekerja pada riwayat pesanan akun Anda.</span></div>
      <div className="ops-table-wrap"><table className="ops-table user-order-table" data-testid="user-order-table"><thead><tr><th>Pesanan</th><th>Tanggal</th><th>Ringkasan item</th><th>Jenis</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{visible.length?visible.map(order=><tr key={order.id}><td><strong>{orderReference(order)}</strong></td><td>{new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date(order.created_at))}</td><td><strong>{titleFor(order)}</strong><small>{order.items.length} item</small></td><td>{[...new Set(order.items.map(item=>kindLabel(item.item_kind_snapshot)))].join(', ')}</td><td>{formatRupiah(order.total_amount)}</td><td><span className={`ops-status ops-status--${statusTone(order.status)}`}>{statusLabel(order.status)}</span></td><td><div className="table-action-group"><button type="button" className="button button-outline button-compact" onClick={()=>setSelectedOrderId(order.id)}><Eye aria-hidden="true" size={15}/>Lihat Detail</button>{order.status==='pending_payment'?<a className="button button-primary button-compact" href={`/checkout?order=${encodeURIComponent(order.id)}`}>Bayar <ArrowRight aria-hidden="true" size={14}/></a>:null}</div></td></tr>):<tr><td colSpan={7}>Tidak ada pesanan yang cocok dengan filter.</td></tr>}</tbody></table></div>
      <TablePagination page={safePage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} label="Pagination riwayat pesanan"/>
    </section>

    <dialog ref={dialogRef} className="ops-dialog" aria-labelledby="user-order-detail-title" onClose={() => setSelectedOrderId(null)}>
      {selected ? <div className="ops-dialog__surface">
        <header className="ops-dialog__header"><div><p className="kicker">Detail pesanan</p><h2 id="user-order-detail-title">{orderReference(selected)}</h2><p>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(selected.created_at))}</p></div><button type="button" className="ops-icon-button" onClick={() => setSelectedOrderId(null)} aria-label="Tutup detail pesanan"><X aria-hidden="true" /></button></header>
        <div className="ops-detail-grid"><div><span>Status order</span><strong>{statusLabel(selected.status)}</strong></div><div><span>Status pembayaran</span><strong>{selected.status === 'paid' ? 'Terverifikasi' : statusLabel(selected.status)}</strong></div><div><span>Jumlah item</span><strong>{selected.items.length}</strong></div><div><span>Total</span><strong>{formatRupiah(selected.total_amount)}</strong></div></div>
        <section className="ops-dialog__section"><h3>Item pesanan</h3>{selected.items.map(item => <div className="ops-line-item" key={item.id}><div><strong>{item.name_snapshot}</strong><span>{kindLabel(item.item_kind_snapshot)} · Qty 1</span></div><div><span>{formatRupiah(item.unit_price_amount)} / item</span><strong>{formatRupiah(item.unit_price_amount)}</strong></div></div>)}</section>
        <div className="ops-total-row"><span>Total</span><strong>{formatRupiah(selected.total_amount)}</strong></div>
        {selected.status === 'pending_payment' ? <a className="button button-primary" href={`/checkout?order=${encodeURIComponent(selected.id)}`}>Lanjutkan Pembayaran <ArrowRight aria-hidden="true" size={16} /></a> : null}
      </div> : null}
    </dialog>
  </>
}
