'use client'

import { Download, Eye, RefreshCw, ShoppingCart, TrendingUp, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { formatRupiah } from '@/lib/commerce/money'
import {
  buildCommerceCsv,
  commerceCsvFields,
  type AdminCommerceOrder,
  type AdminCommerceReport,
  type CommerceCsvField,
} from '@/lib/admin/commerce-reporting'
import { createClient } from '@/lib/supabase/client'
import { TablePagination } from './table-pagination'

type Mode = 'overview' | 'orders' | 'reports'
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>
type UntypedClient = { rpc: <T>(name: string, args?: Record<string, unknown>) => RpcResult<T> }

const EMPTY_REPORT: AdminCommerceReport = {
  total_revenue: 0, total_transactions: 0, paid_orders: 0, pending_orders: 0, customer_count: 0, average_order_value: 0,
  total_users: 0, total_mentors: 0, total_sessions: 0, sessions_today: 0, pending_sessions: 0,
  trend: [], product_distribution: [], best_sellers: [],
}

function toRange(start: string, end: string) {
  const from = start ? new Date(`${start}T00:00:00`).toISOString() : null
  const to = end ? new Date(new Date(`${end}T00:00:00`).getTime() + 86_400_000).toISOString() : null
  return { from, to }
}

function statusLabel(status: string) {
  if (status === 'pending_payment' || status === 'pending') return 'Menunggu pembayaran'
  if (status === 'paid') return 'Lunas'
  if (status === 'payment_failed' || status === 'failed') return 'Pembayaran gagal'
  if (status === 'expired') return 'Kedaluwarsa'
  if (status === 'cancelled') return 'Dibatalkan'
  if (status === 'creating') return 'Menyiapkan pembayaran'
  return status.replaceAll('_', ' ')
}

function statusTone(status: string) {
  if (status === 'paid') return 'positive'
  if (status === 'pending_payment' || status === 'pending' || status === 'creating') return 'warning'
  return 'danger'
}

function itemKindLabel(kind: string) {
  if (kind === 'digital_product') return 'Produk Digital'
  if (kind === 'private_mentoring') return 'Private Mentoring'
  return kind.replaceAll('_', ' ')
}

export function AdminCommerceOperations({ mode, onNavigate }: { mode: Mode; onNavigate?: (section: string) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const client = supabase as unknown as UntypedClient
  const [orders, setOrders] = useState<AdminCommerceOrder[]>([])
  const [report, setReport] = useState<AdminCommerceReport>(EMPTY_REPORT)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(mode === 'overview' ? 5 : 10)
  const [totalOrders, setTotalOrders] = useState(0)
  const [selected, setSelected] = useState<AdminCommerceOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [csvFields, setCsvFields] = useState<CommerceCsvField[]>(commerceCsvFields.map(([key]) => key))
  const [exporting, setExporting] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const range = toRange(startDate, endDate)
    const orderArgs = {
      p_query: mode === 'overview' ? '' : query.trim(),
      p_status: mode === 'overview' ? '' : status,
      p_from: range.from,
      p_to: range.to,
      p_limit: mode === 'overview' ? 5 : pageSize,
      p_offset: mode === 'overview' ? 0 : page * pageSize,
    }
    const [ordersResult, reportResult] = await Promise.all([
      client.rpc<AdminCommerceOrder[]>('list_admin_commerce_orders', orderArgs),
      client.rpc<AdminCommerceReport[]>('get_admin_commerce_report', { p_from: range.from, p_to: range.to }),
    ])
    if (ordersResult.error || reportResult.error) {
      setError(ordersResult.error?.message || reportResult.error?.message || 'Data operasional belum dapat dimuat.')
      setLoading(false)
      return
    }
    const rows = ordersResult.data ?? []
    setOrders(rows)
    setTotalOrders(Number(rows[0]?.total_count ?? 0))
    setReport(reportResult.data?.[0] ?? EMPTY_REPORT)
    setLoading(false)
  }, [client, endDate, mode, page, pageSize, query, startDate, status])

  useEffect(() => { const timer = setTimeout(() => { void load() }, 200); return () => clearTimeout(timer) }, [load])
  useEffect(() => { const dialog = dialogRef.current; if (!dialog) return; if (selected && !dialog.open) dialog.showModal(); if (!selected && dialog.open) dialog.close() }, [selected])

  function changePageSize(value: number) { setPageSize(value); setPage(0) }
  function toggleCsvField(field: CommerceCsvField) { setCsvFields(current => current.includes(field) ? current.filter(item => item !== field) : [...current, field]) }

  async function exportCsv() {
    if (csvFields.length === 0 || exporting) return
    setExporting(true); setError('')
    try {
      const range = toRange(startDate, endDate)
      const collected: AdminCommerceOrder[] = []
      const batchSize = 500
      let offset = 0
      let expected = Number.POSITIVE_INFINITY
      while (offset < expected) {
        const result = await client.rpc<AdminCommerceOrder[]>('list_admin_commerce_orders', {
          p_query: query.trim(), p_status: status, p_from: range.from, p_to: range.to, p_limit: batchSize, p_offset: offset,
        })
        if (result.error) throw new Error(result.error.message)
        const rows = result.data ?? []
        if (offset === 0) expected = Number(rows[0]?.total_count ?? 0)
        collected.push(...rows)
        if (rows.length < batchSize) break
        offset += rows.length
      }
      const csv = buildCommerceCsv(collected, csvFields)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `strativate-report-${startDate || 'awal'}-${endDate || 'sekarang'}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'CSV belum dapat diekspor.')
    } finally { setExporting(false) }
  }

  const maxRevenue = Math.max(1, ...report.trend.map(point => Number(point.revenue)))
  const maxDistribution = Math.max(1, ...report.product_distribution.map(row => Number(row.quantity)))

  if (mode === 'overview') return <div className="ops-page">
    <header className="role-page-title"><p className="kicker">Operasional</p><h2>Ringkasan</h2><p>Gambaran operasional dari Shared Commerce, akun, mentor, dan Private Mentoring.</p></header>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="ops-metrics">
      <Metric label="Revenue" value={formatRupiah(report.total_revenue)} detail={`${report.paid_orders} order lunas`} />
      <Metric label="Total orders" value={String(report.total_transactions)} detail={`${report.pending_orders} pending`} />
      <Metric label="Mentee" value={String(report.total_users)} detail={`${report.customer_count} customer pada range`} />
      <Metric label="Mentor aktif" value={String(report.total_mentors)} detail="Domain mentor" />
      <Metric label="Mentoring sessions" value={String(report.total_sessions)} detail={`${report.sessions_today} sesi hari ini`} />
      <Metric label="Butuh tindak lanjut" value={String(report.pending_sessions)} detail="Fokus / penjadwalan" />
    </div>
    <div className="ops-overview-grid">
      <section className="role-card"><div className="ops-section-heading"><div><p className="kicker">Trend</p><h3>Revenue & order</h3></div><TrendingUp aria-hidden="true" /></div><TrendChart points={report.trend} max={maxRevenue} /></section>
      <section className="role-card"><div className="ops-section-heading"><div><p className="kicker">Quick actions</p><h3>Buka area operasional</h3></div></div><div className="ops-quick-actions"><button type="button" onClick={() => onNavigate?.('orders')}><ShoppingCart /><span><strong>Pesanan</strong><small>Order & payment history</small></span></button><button type="button" onClick={() => onNavigate?.('sessions')}><UsersRound /><span><strong>Mentoring Sessions</strong><small>{report.pending_sessions} membutuhkan tindak lanjut</small></span></button><button type="button" onClick={() => onNavigate?.('reports')}><TrendingUp /><span><strong>Laporan</strong><small>Analisis dan export CSV</small></span></button></div></section>
    </div>
    <OrdersTable orders={orders} loading={loading} onDetail={setSelected} compact />
    <OrderDialog dialogRef={dialogRef} order={selected} onClose={() => setSelected(null)} />
  </div>

  return <div className="ops-page">
    <header className="role-page-title"><p className="kicker">{mode === 'reports' ? 'Bisnis · reporting' : 'Operasional · Shared Commerce'}</p><h2>{mode === 'reports' ? 'Laporan Penjualan' : 'Pesanan'}</h2><p>{mode === 'reports' ? 'Metric, chart, transaksi, dan export CSV memakai order/payment data yang sama.' : 'Source utama order dan payment history Shared Commerce.'}</p></header>
    <div className="ops-filter-bar">
      <label className="ops-field ops-field--wide"><span>Cari</span><input value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Order, email, atau produk" /></label>
      <label className="ops-field"><span>Status</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}><option value="">Semua status</option><option value="pending_payment">Menunggu pembayaran</option><option value="paid">Lunas</option><option value="payment_failed">Pembayaran gagal</option><option value="expired">Kedaluwarsa</option><option value="cancelled">Dibatalkan</option></select></label>
      <label className="ops-field"><span>Dari</span><input type="date" value={startDate} onChange={event => { setStartDate(event.target.value); setPage(0) }} /></label>
      <label className="ops-field"><span>Sampai</span><input type="date" value={endDate} min={startDate || undefined} onChange={event => { setEndDate(event.target.value); setPage(0) }} /></label>
      <label className="ops-field"><span>Per halaman</span><select value={pageSize} onChange={event => changePageSize(Number(event.target.value))}>{[5, 10, 20].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      <button type="button" className="button button-outline ops-refresh" onClick={() => void load()} disabled={loading}><RefreshCw aria-hidden="true" size={15} />Muat ulang</button>
    </div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}

    {mode === 'reports' ? <>
      <div className="ops-metrics"><Metric label="Total revenue" value={formatRupiah(report.total_revenue)} detail="Order lunas" /><Metric label="Transaksi" value={String(report.total_transactions)} detail={`${report.paid_orders} lunas`} /><Metric label="Pending" value={String(report.pending_orders)} detail="Menunggu pembayaran" /><Metric label="Customer" value={String(report.customer_count)} detail="Customer unik" /><Metric label="Rata-rata order" value={formatRupiah(Math.round(report.average_order_value || 0))} detail="Order lunas" /></div>
      <div className="ops-report-grid"><section className="role-card"><div className="ops-section-heading"><div><p className="kicker">Trend</p><h3>Revenue & transaksi</h3></div></div><TrendChart points={report.trend} max={maxRevenue} /></section><section className="role-card"><div className="ops-section-heading"><div><p className="kicker">Distribusi</p><h3>Jenis produk</h3></div></div><div className="ops-bars">{report.product_distribution.length ? report.product_distribution.map(row => <div key={row.kind}><span>{itemKindLabel(row.kind)}</span><i><b style={{ width: `${Math.max(4, Number(row.quantity) / maxDistribution * 100)}%` }} /></i><strong>{row.quantity}</strong></div>) : <p className="muted">Belum ada transaksi pada range ini.</p>}</div></section><section className="role-card ops-best-sellers"><div className="ops-section-heading"><div><p className="kicker">Best seller</p><h3>Produk terlaris</h3></div></div>{report.best_sellers.length ? report.best_sellers.map((row, index) => <div key={`${row.name}-${row.kind}`}><span>{index + 1}</span><p><strong>{row.name}</strong><small>{itemKindLabel(row.kind)} · {row.quantity} terjual</small></p><b>{formatRupiah(row.revenue)}</b></div>) : <p className="muted">Belum ada order lunas pada range ini.</p>}</section></div>
      <section className="role-card ops-export"><div className="ops-section-heading"><div><p className="kicker">Export</p><h3>Export CSV</h3><p>Pilih kolom; date range mengikuti filter laporan di atas.</p></div><button type="button" className="button button-primary" disabled={exporting || csvFields.length === 0} onClick={() => void exportCsv()}><Download aria-hidden="true" size={16} />{exporting ? 'Menyiapkan…' : 'Export CSV'}</button></div><div className="ops-field-picker">{commerceCsvFields.map(([key, label]) => <label key={key}><input type="checkbox" checked={csvFields.includes(key)} onChange={() => toggleCsvField(key)} />{label}</label>)}</div></section>
    </> : null}

    <section className="role-card ops-table-section"><div className="ops-section-heading"><div><p className="kicker">{mode === 'reports' ? 'Transaksi terkini' : 'Order & payment history'}</p><h3>{mode === 'reports' ? 'Transaksi' : 'Pesanan'}</h3></div><span>{totalOrders} data</span></div><OrdersTable orders={orders} loading={loading} onDetail={setSelected} /><TablePagination page={page} pageSize={pageSize} totalItems={totalOrders} onPageChange={setPage} disabled={loading} label="Pagination pesanan" /></section>
    <OrderDialog dialogRef={dialogRef} order={selected} onClose={() => setSelected(null)} />
  </div>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <section className="role-card ops-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></section>
}

function TrendChart({ points, max }: { points: AdminCommerceReport['trend']; max: number }) {
  if (!points.length) return <div className="ops-zero-chart"><TrendingUp aria-hidden="true" /><p>Belum ada data pada range ini.</p></div>
  return <div className="ops-trend" role="img" aria-label="Trend revenue dan transaksi">{points.map(point => <div key={point.date} title={`${point.date}: ${formatRupiah(point.revenue)}, ${point.transactions} transaksi`}><i style={{ height: `${Math.max(5, Number(point.revenue) / max * 100)}%` }} /><span>{new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(new Date(point.date))}</span><small>{point.transactions}</small></div>)}</div>
}

function OrdersTable({ orders, loading, onDetail, compact = false }: { orders: AdminCommerceOrder[]; loading: boolean; onDetail: (order: AdminCommerceOrder) => void; compact?: boolean }) {
  return <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Order</th><th>User</th><th>Tanggal</th><th>Item</th><th>Total</th><th>Order status</th><th>Payment</th><th aria-label="Action" /></tr></thead><tbody>{loading ? <tr><td colSpan={8}>Memuat data…</td></tr> : orders.length === 0 ? <tr><td colSpan={8}>Belum ada order yang cocok.</td></tr> : orders.map(order => <tr key={order.order_id}><td><strong>#STR-{order.order_id.slice(0, 8).toUpperCase()}</strong></td><td>{order.user_email || '—'}</td><td>{new Intl.DateTimeFormat('id-ID', { dateStyle: compact ? 'short' : 'medium' }).format(new Date(order.created_at))}</td><td><strong>{order.item_summary}</strong><small>{order.item_count} item</small></td><td>{formatRupiah(order.total_amount)}</td><td><span className={`ops-status ops-status--${statusTone(order.order_status)}`}>{statusLabel(order.order_status)}</span></td><td><span className={`ops-status ops-status--${statusTone(order.payment?.status ?? order.order_status)}`}>{statusLabel(order.payment?.status ?? order.order_status)}</span></td><td><button type="button" className="ops-icon-button" onClick={() => onDetail(order)} aria-label={`Lihat detail pesanan ${order.order_id}`} title="Lihat Detail Pesanan"><Eye aria-hidden="true" size={17} /></button></td></tr>)}</tbody></table></div>
}

const OrderDialog = ({ dialogRef, order, onClose }: { dialogRef: RefObject<HTMLDialogElement | null>; order: AdminCommerceOrder | null; onClose: () => void }) => <dialog ref={dialogRef} className="ops-dialog" aria-labelledby="admin-order-detail-title" onClose={onClose}>{order ? <div className="ops-dialog__surface"><header className="ops-dialog__header"><div><p className="kicker">Detail pesanan</p><h2 id="admin-order-detail-title">#STR-{order.order_id.slice(0, 8).toUpperCase()}</h2><p>{order.user_email} · {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(order.created_at))}</p></div><button type="button" className="ops-icon-button" onClick={onClose} aria-label="Tutup detail pesanan"><X /></button></header><div className="ops-detail-grid"><div><span>Status order</span><strong>{statusLabel(order.order_status)}</strong></div><div><span>Status pembayaran</span><strong>{statusLabel(order.payment?.status ?? order.order_status)}</strong></div><div><span>Dibayar</span><strong>{order.paid_at ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.paid_at)) : '—'}</strong></div><div><span>Total</span><strong>{formatRupiah(order.total_amount)}</strong></div></div><section className="ops-dialog__section"><h3>Item</h3>{order.items.map(item => <div className="ops-line-item" key={item.id}><div><strong>{item.name}</strong><span>{itemKindLabel(item.kind)} · Qty {item.quantity}</span></div><div><span>{formatRupiah(item.unitPrice)} / item</span><strong>{formatRupiah(item.subtotal)}</strong></div></div>)}</section>{order.payment ? <section className="ops-dialog__section"><h3>Payment</h3><dl className="ops-payment-detail"><div><dt>Provider</dt><dd>{order.payment.provider}</dd></div><div><dt>Provider order</dt><dd>{order.payment.providerOrderId}</dd></div><div><dt>Transaction reference</dt><dd>{order.payment.providerTransactionId ?? '—'}</dd></div><div><dt>Payment type</dt><dd>{order.payment.paymentType ?? '—'}</dd></div><div><dt>Provider status</dt><dd>{order.payment.providerStatus ?? order.payment.status}</dd></div><div><dt>Updated</dt><dd>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.payment.updatedAt))}</dd></div></dl></section> : <p className="muted">Belum ada payment attempt tercatat untuk order ini.</p>}<div className="ops-total-row"><span>Total</span><strong>{formatRupiah(order.total_amount)}</strong></div></div> : null}</dialog>
