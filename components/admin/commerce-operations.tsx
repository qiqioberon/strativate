'use client'

import { Eye, RefreshCw, ShoppingCart, TrendingUp, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { formatRupiah } from '@/lib/commerce/money'
import { itemKindLabel, paymentMethodLabel } from '@/lib/admin/sales-reporting'
import { adminFormError } from '@/lib/auth/errors'
import {
  type AdminCommerceOrder,
  type AdminCommerceReport,
} from '@/lib/admin/commerce-reporting'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { createClient } from '@/lib/supabase/client'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'

type Mode = 'overview' | 'orders'
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>
type UntypedClient = { rpc: <T>(name: string, args?: Record<string, unknown>) => RpcResult<T> }
type OrderSortKey = 'order' | 'user' | 'date' | 'item' | 'total' | 'order_status' | 'payment'

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
  if (status === 'pending_payment' || status === 'pending') return 'Pending payment'
  if (status === 'paid') return 'Paid'
  if (status === 'payment_failed' || status === 'failed') return 'Payment failed'
  if (status === 'expired') return 'Expired'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'creating') return 'Preparing payment'
  return status.replaceAll('_', ' ')
}
function statusTone(status: string) {
  if (status === 'paid') return 'positive'
  if (status === 'pending_payment' || status === 'pending' || status === 'creating') return 'warning'
  return 'danger'
}

export function AdminCommerceOperations({ mode, onNavigate, focusOrderId }: { mode: Mode; onNavigate?: (section: string) => void; focusOrderId?: string | null }) {
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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selected, setSelected] = useState<AdminCommerceOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  const selectedOrderIdRef = useRef<string | null>(null)

  const setOrderSelection = useCallback((order: AdminCommerceOrder | null) => {
    selectedOrderIdRef.current = order?.order_id ?? null
    setSelectedOrderId(order?.order_id ?? null)
    setSelected(order)
  }, [])

  const loadOrdersAndReport = useCallback(async () => {
    setLoading(true); setError('')
    const range = toRange(startDate, endDate)
    const orderArgs = {
      p_query: mode === 'overview' ? '' : query.trim(), p_status: mode === 'overview' ? '' : status,
      p_from: range.from, p_to: range.to, p_limit: mode === 'overview' ? 5 : pageSize, p_offset: mode === 'overview' ? 0 : page * pageSize,
    }
    const [ordersResult, reportResult] = await Promise.all([
      client.rpc<AdminCommerceOrder[]>('list_admin_commerce_orders', orderArgs),
      client.rpc<AdminCommerceReport[]>('get_admin_commerce_report', { p_from: range.from, p_to: range.to }),
    ])
    if (ordersResult.error || reportResult.error) {
      setError(adminFormError(ordersResult.error || reportResult.error, 'Unable to load operational data.')); setLoading(false); return null
    }
    const rows = ordersResult.data ?? []
    setOrders(rows); setTotalOrders(Number(rows[0]?.total_count ?? 0)); setReport(reportResult.data?.[0] ?? EMPTY_REPORT)
    setLoading(false)
    return rows
  }, [client, endDate, mode, page, pageSize, query, startDate, status])

  const refreshSelectedOrder = useCallback(async (selectedOrderId: string, freshRows: AdminCommerceOrder[]) => {
    const visibleMatch = freshRows.find(order => order.order_id === selectedOrderId) ?? null
    if (visibleMatch) {
      if (selectedOrderIdRef.current === selectedOrderId) setSelected(visibleMatch)
      return
    }

    const detailResult = await client.rpc<AdminCommerceOrder[]>('list_admin_commerce_orders', {
      p_query: selectedOrderId, p_status: '', p_from: null, p_to: null, p_limit: 1, p_offset: 0,
    })
    if (detailResult.error || selectedOrderIdRef.current !== selectedOrderId) return

    const canonical = detailResult.data?.find(order => order.order_id === selectedOrderId) ?? null
    if (canonical) {
      setSelected(canonical)
      return
    }
    setOrderSelection(null)
  }, [client, setOrderSelection])

  const load = useCallback(async () => {
    const rows = await loadOrdersAndReport()
    if (!rows) return
    const selectedOrderId = selectedOrderIdRef.current
    if (selectedOrderId) await refreshSelectedOrder(selectedOrderId, rows)
  }, [loadOrdersAndReport, refreshSelectedOrder])

  useEffect(() => { const timer = setTimeout(() => { void load() }, 200); return () => clearTimeout(timer) }, [load])
  useOperationalInvalidation(['commerce', 'admin-overview'], () => { void load() })
  useEffect(() => {
    if (!focusOrderId || mode !== 'orders') return
    setQuery(focusOrderId)
    setPage(0)
  }, [focusOrderId, mode])
  useEffect(() => {
    if (!focusOrderId || mode !== 'orders') return
    const match = orders.find(order => order.order_id === focusOrderId)
    if (match) setOrderSelection(match)
  }, [focusOrderId, mode, orders, setOrderSelection])
  useEffect(() => { const dialog = dialogRef.current; if (!dialog) return; if (selected && !dialog.open) dialog.showModal(); if (!selected && dialog.open) dialog.close() }, [selected])
  function openOrder(order: AdminCommerceOrder) { setOrderSelection(order) }
  function closeOrder() { setOrderSelection(null) }
  function changePageSize(value: number) { setPageSize(value); setPage(0) }

  const maxRevenue = Math.max(1, ...report.trend.map(point => Number(point.revenue)))

  if (mode === 'overview') return <div className="ops-page">
    <header className="role-page-title"><h2>Overview</h2></header>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="ops-metrics"><Metric label="Revenue" value={formatRupiah(report.total_revenue)} detail={`${report.paid_orders} paid orders`} /><Metric label="Total orders" value={String(report.total_transactions)} detail={`${report.pending_orders} pending`} /><Metric label="Mentees" value={String(report.total_users)} detail={`${report.customer_count} customers in this period`} /><Metric label="Active mentors" value={String(report.total_mentors)} detail="Active mentor accounts" /><Metric label="Mentoring sessions" value={String(report.total_sessions)} detail={`${report.sessions_today} sessions today`} /><Metric label="Action needed" value={String(report.pending_sessions)} detail="Focus / scheduling" /></div>
    <div className="ops-overview-grid"><section className="role-card"><div className="ops-section-heading"><div><h3>Revenue & orders</h3></div><TrendingUp aria-hidden="true" /></div><TrendChart points={report.trend} max={maxRevenue} /></section><section className="role-card"><div className="ops-section-heading"><div><h3>Quick actions</h3></div></div><div className="ops-quick-actions"><button type="button" onClick={() => onNavigate?.('orders')}><ShoppingCart /><span><strong>Orders</strong></span></button><button type="button" onClick={() => onNavigate?.('sessions')}><UsersRound /><span><strong>Mentoring Sessions</strong><small>{report.pending_sessions} need action</small></span></button><button type="button" onClick={() => onNavigate?.('reports')}><TrendingUp /><span><strong>Reports</strong></span></button></div></section></div>
    <OrdersTable orders={orders} loading={loading} onDetail={openOrder} compact />
    <OrderDialog dialogRef={dialogRef} order={selectedOrderId ? selected : null} onClose={closeOrder} />
  </div>

  return <div className="ops-page">
    <header className="role-page-title"><h2>Orders</h2></header>
    <div className="ops-filter-bar">
      <label className="ops-field ops-field--wide"><span>Search</span><input value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Order, email or product" /></label>
      <label className="ops-field"><span>Status</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}><option value="">All statuses</option><option value="pending_payment">Pending payment</option><option value="paid">Paid</option><option value="payment_failed">Payment failed</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select></label>
      <label className="ops-field"><span>From</span><input type="date" value={startDate} onChange={event => { setStartDate(event.target.value); setPage(0) }} /></label>
      <label className="ops-field"><span>To</span><input type="date" value={endDate} min={startDate || undefined} onChange={event => { setEndDate(event.target.value); setPage(0) }} /></label>
      <label className="ops-field"><span>Per page</span><select value={pageSize} onChange={event => changePageSize(Number(event.target.value))}>{[5, 10, 20].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      <button type="button" className="button button-outline ops-refresh" onClick={() => void load()} disabled={loading}><RefreshCw aria-hidden="true" size={15} />Refresh</button>
    </div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <section className="role-card ops-table-section"><div className="ops-section-heading"><div><h3>Orders</h3></div><span>{totalOrders} orders</span></div><OrdersTable orders={orders} loading={loading} onDetail={openOrder} /><TablePagination language="en" page={page} pageSize={pageSize} totalItems={totalOrders} onPageChange={setPage} disabled={loading} label="Order pages" /></section>
    <OrderDialog dialogRef={dialogRef} order={selectedOrderId ? selected : null} onClose={closeOrder} />
  </div>
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <section className="role-card ops-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></section> }
function TrendChart({ points, max }: { points: AdminCommerceReport['trend']; max: number }) {
  if (!points.length) return <div className="ops-zero-chart"><TrendingUp aria-hidden="true" /><p>No data in this period.</p></div>
  return <div className="ops-trend" role="img" aria-label="Revenue and transaction trend">{points.map(point => <div key={point.date} title={`${point.date}: ${formatRupiah(point.revenue)}, ${point.transactions} transactions`}><i style={{ height: `${Math.max(5, Number(point.revenue) / max * 100)}%` }} /><span>{new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(point.date))}</span><small>{point.transactions}</small></div>)}</div>
}

function OrdersTable({ orders, loading, onDetail, compact = false }: { orders: AdminCommerceOrder[]; loading: boolean; onDetail: (order: AdminCommerceOrder) => void; compact?: boolean }) {
  const [sortKey, setSortKey] = useState<OrderSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const visibleOrders = useMemo(() => {
    if (!sortKey || !sortDirection) return orders
    const sign = sortDirection === 'asc' ? 1 : -1
    return [...orders].sort((a, b) => {
      if (sortKey === 'date') return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * sign
      if (sortKey === 'total') return (a.total_amount - b.total_amount) * sign
      if (sortKey === 'order_status' || sortKey === 'payment') {
        const left = sortKey === 'order_status' ? a.order_status : a.payment?.status ?? a.order_status
        const right = sortKey === 'order_status' ? b.order_status : b.payment?.status ?? b.order_status
        // Retain the established status order independently of translated labels.
        const priority: Record<string, number> = { cancelled: 0, expired: 1, paid: 2, pending_payment: 3, pending: 3, creating: 4, payment_failed: 5, failed: 5 }
        return ((priority[left] ?? 6) - (priority[right] ?? 6) || left.localeCompare(right)) * sign
      }
      const value = (order: AdminCommerceOrder) => {
        if (sortKey === 'order') return order.order_id
        if (sortKey === 'user') return order.user_email ?? ''
        if (sortKey === 'item') return order.item_summary
        return order.item_summary
      }
      return value(a).localeCompare(value(b), 'id-ID') * sign
    })
  }, [orders, sortDirection, sortKey])
  const changeSort = (key: string | null, direction: SortDirection) => { setSortKey(key as OrderSortKey | null); setSortDirection(direction) }
  return <div className="ops-table-wrap"><table className="ops-table"><thead><tr><SortableTableHeader label="Order" sortKey="order" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Customer" sortKey="user" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Date" sortKey="date" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Item" sortKey="item" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Total" sortKey="total" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Order status" sortKey="order_status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Payment" sortKey="payment" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th aria-label="Action" /></tr></thead><tbody>{loading ? <tr><td colSpan={8}>Loading data…</td></tr> : visibleOrders.length === 0 ? <tr><td colSpan={8}>No matching orders.</td></tr> : visibleOrders.map(order => <tr key={order.order_id}><td><strong>#STR-{order.order_id.slice(0, 8).toUpperCase()}</strong></td><td>{order.user_email || '—'}</td><td>{new Intl.DateTimeFormat('en-GB', { dateStyle: compact ? 'short' : 'medium' }).format(new Date(order.created_at))}</td><td><strong>{order.item_summary}</strong><small>{order.item_count} items</small></td><td>{formatRupiah(order.total_amount)}</td><td><span className={`ops-status ops-status--${statusTone(order.order_status)}`}>{statusLabel(order.order_status)}</span></td><td><span className={`ops-status ops-status--${statusTone(order.payment?.status ?? order.order_status)}`}>{statusLabel(order.payment?.status ?? order.order_status)}</span></td><td><button type="button" className="ops-icon-button" onClick={() => onDetail(order)} aria-label={`View order details ${order.order_id}`} title="View order details"><Eye aria-hidden="true" size={17} /></button></td></tr>)}</tbody></table></div>
}

const OrderDialog = ({ dialogRef, order, onClose }: { dialogRef: RefObject<HTMLDialogElement | null>; order: AdminCommerceOrder | null; onClose: () => void }) => <dialog ref={dialogRef} className="ops-dialog" aria-labelledby="admin-order-detail-title" onClose={onClose}>{order ? <div className="ops-dialog__surface"><header className="ops-dialog__header"><div><h2 id="admin-order-detail-title">Order details</h2><p>#STR-{order.order_id.slice(0, 8).toUpperCase()} · {order.user_email} · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(order.created_at))}</p></div><button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close order details"><X /></button></header><div className="ops-detail-grid"><div><span>Order status</span><strong>{statusLabel(order.order_status)}</strong></div><div><span>Payment status</span><strong>{statusLabel(order.payment?.status ?? order.order_status)}</strong></div><div><span>Paid</span><strong>{order.paid_at ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.paid_at)) : '—'}</strong></div><div><span>Total</span><strong>{formatRupiah(order.total_amount)}</strong></div></div><section className="ops-dialog__section"><h3>Item</h3>{order.items.map(item => <div className="ops-line-item" key={item.id}><div><strong>{item.name}</strong><span>{itemKindLabel(item.kind)} · Qty {item.quantity}</span></div><div><span>{formatRupiah(item.unitPrice)} / item</span><strong>{formatRupiah(item.subtotal)}</strong></div></div>)}</section>{order.payment ? <section className="ops-dialog__section"><h3>Payment</h3><dl className="ops-payment-detail"><div><dt>Provider</dt><dd>{order.payment.provider}</dd></div><div><dt>Provider order</dt><dd>{order.payment.providerOrderId}</dd></div><div><dt>Transaction reference</dt><dd>{order.payment.providerTransactionId ?? '—'}</dd></div><div><dt>Payment type</dt><dd>{order.payment.paymentType ? paymentMethodLabel(order.payment.paymentType) : '—'}</dd></div><div><dt>Provider status</dt><dd>{order.payment.providerStatus ?? order.payment.status}</dd></div><div><dt>Updated</dt><dd>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.payment.updatedAt))}</dd></div></dl></section> : <p className="muted">No payment attempt has been recorded for this order.</p>}<div className="ops-total-row"><span>Total</span><strong>{formatRupiah(order.total_amount)}</strong></div></div> : null}</dialog>
