'use client'

import { PaymentReceiptActions } from '@/components/commerce/payment-receipt-actions'
import { ArrowUpRight, CalendarDays, ClipboardList, Eye, GraduationCap, RefreshCw, ShoppingCart, TrendingUp, UsersRound, Wallet, X, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { formatRupiah } from '@/lib/commerce/money'
import { displayDate, itemKindLabel, jakartaDate, paymentMethodLabel, shiftDate } from '@/lib/admin/sales-reporting'
import { adminFormError } from '@/lib/auth/errors'
import {
  type AdminCommerceOrder,
  type AdminCommerceReport,
} from '@/lib/admin/commerce-reporting'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { createClient } from '@/lib/supabase/client'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'
import styles from './commerce-operations.module.css'

type Mode = 'overview' | 'orders'
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>
type UntypedClient = { rpc: <T>(name: string, args?: Record<string, unknown>) => RpcResult<T> }
type OrderSortKey = 'order' | 'user' | 'date' | 'item' | 'total' | 'order_status' | 'payment'
const OVERVIEW_PERIODS = { all: 'All Time', today: 'Today', week: 'Last 7 Days', month: 'Last 30 Days' } as const
type OverviewPeriod = keyof typeof OVERVIEW_PERIODS

const EMPTY_REPORT: AdminCommerceReport = {
  total_revenue: 0, total_transactions: 0, paid_orders: 0, pending_orders: 0, customer_count: 0, average_order_value: 0,
  total_users: 0, total_mentors: 0, total_sessions: 0, sessions_today: 0, pending_sessions: 0,
  trend: [], product_distribution: [], best_sellers: [],
}

function toRange(start: string, end: string) {
  const from = start ? new Date(`${start}T00:00:00+07:00`).toISOString() : null
  const to = end ? new Date(`${shiftDate(end, 1)}T00:00:00+07:00`).toISOString() : null
  return { from, to }
}
function overviewRange(period: OverviewPeriod) {
  if (period === 'all') return { from: null, to: null }
  const today = jakartaDate()
  return toRange(shiftDate(today, period === 'week' ? -6 : period === 'month' ? -29 : 0), today)
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
  const [period, setPeriod] = useState<OverviewPeriod>('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(mode === 'overview' ? 5 : 10)
  const [totalOrders, setTotalOrders] = useState(0)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selected, setSelected] = useState<AdminCommerceOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  const selectedOrderIdRef = useRef<string | null>(null)
  const loadVersion = useRef(0)

  const setOrderSelection = useCallback((order: AdminCommerceOrder | null) => {
    selectedOrderIdRef.current = order?.order_id ?? null
    setSelectedOrderId(order?.order_id ?? null)
    setSelected(order)
  }, [])

  const loadOrdersAndReport = useCallback(async () => {
    const version = ++loadVersion.current
    setLoading(true); setError('')
    const range = mode === 'overview' ? overviewRange(period) : toRange(startDate, endDate)
    const orderArgs = {
      p_query: mode === 'overview' ? '' : query.trim(), p_status: mode === 'overview' ? '' : status,
      p_from: range.from, p_to: range.to, p_limit: mode === 'overview' ? 5 : pageSize, p_offset: mode === 'overview' ? 0 : page * pageSize,
    }
    try {
      const [ordersResult, reportResult] = await Promise.all([
      client.rpc<AdminCommerceOrder[]>('list_admin_commerce_orders', orderArgs),
      client.rpc<AdminCommerceReport[]>('get_admin_commerce_report', { p_from: range.from, p_to: range.to }),
      ])
      if (version !== loadVersion.current) return null
      if (ordersResult.error || reportResult.error) {
        setError(adminFormError(ordersResult.error || reportResult.error, 'Unable to load operational data.')); return null
      }
      const rows = ordersResult.data ?? []
      setOrders(rows); setTotalOrders(Number(rows[0]?.total_count ?? 0)); setReport(reportResult.data?.[0] ?? EMPTY_REPORT)
      return { rows, version }
    } catch (cause) {
      if (version === loadVersion.current) setError(adminFormError(cause, 'Unable to load operational data.'))
      return null
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }, [client, endDate, mode, page, pageSize, period, query, startDate, status])

  const refreshSelectedOrder = useCallback(async (selectedOrderId: string, freshRows: AdminCommerceOrder[], version: number) => {
    if (version !== loadVersion.current) return
    const visibleMatch = freshRows.find(order => order.order_id === selectedOrderId) ?? null
    if (visibleMatch) {
      if (selectedOrderIdRef.current === selectedOrderId) setSelected(visibleMatch)
      return
    }

    const detailResult = await client.rpc<AdminCommerceOrder[]>('list_admin_commerce_orders', {
      p_query: selectedOrderId, p_status: '', p_from: null, p_to: null, p_limit: 1, p_offset: 0,
    })
    if (detailResult.error || selectedOrderIdRef.current !== selectedOrderId || version !== loadVersion.current) return

    const canonical = detailResult.data?.find(order => order.order_id === selectedOrderId) ?? null
    if (canonical) {
      setSelected(canonical)
      return
    }
    setOrderSelection(null)
  }, [client, setOrderSelection])

  const load = useCallback(async () => {
    const result = await loadOrdersAndReport()
    if (!result) return
    const selectedOrderId = selectedOrderIdRef.current
    if (selectedOrderId) await refreshSelectedOrder(selectedOrderId, result.rows, result.version)
  }, [loadOrdersAndReport, refreshSelectedOrder])

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => { void load() }, 200)
    return () => { clearTimeout(timer); loadVersion.current += 1 }
  }, [load])
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
  const orderOpen = Boolean(selected)
  useEffect(() => {
    if (!orderOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [orderOpen])
  function openOrder(order: AdminCommerceOrder) { setOrderSelection(order) }
  function closeOrder() { setOrderSelection(null) }
  function changePageSize(value: number) { setPageSize(value); setPage(0) }

  const ready = !loading && !error
  const count = (value: number) => ready ? new Intl.NumberFormat('en-GB').format(value) : '—'

  if (mode === 'overview') return <div className={`ops-page ${styles.overview}`}>
    <header className={`role-page-title ${styles.overviewHeader}`}>
      <div><h2>Overview</h2><p>Commerce for your selected period. Operational counts across all time.</p></div>
      <label className={`ops-field ${styles.period}`}><span>Commerce period · WIB</span><select value={period} onChange={event => setPeriod(event.target.value as OverviewPeriod)}>{Object.entries(OVERVIEW_PERIODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </header>
    {error ? <div className={styles.recovery} role="alert"><p>{error}</p><button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw size={15} aria-hidden="true"/>Try again</button></div> : null}
    <div className={styles.metrics} aria-busy={loading}>
      <Metric label="Revenue" value={ready ? formatRupiah(report.total_revenue) : '—'} detail={ready ? `${count(report.paid_orders)} paid orders · ${OVERVIEW_PERIODS[period]}` : loading ? 'Loading commerce…' : 'Data unavailable'} icon={Wallet} tone="orange" wide />
      <Metric label="Total orders" value={count(report.total_transactions)} detail={ready ? `${count(report.pending_orders)} pending payment · ${OVERVIEW_PERIODS[period]}` : 'Selected commerce period'} icon={ShoppingCart} tone="orange" />
      <Metric label="Mentees" value={count(report.total_users)} detail="All mentee accounts · global" icon={UsersRound} />
      <Metric label="Active mentors" value={count(report.total_mentors)} detail="Active mentor accounts · global" icon={GraduationCap} />
      <Metric label="Mentoring sessions" value={count(report.total_sessions)} detail={ready ? `Private Mentoring · ${count(report.sessions_today)} scheduled today (WIB)` : 'Private Mentoring · all time'} icon={CalendarDays} />
      <Metric label="Action needed" value={count(report.pending_sessions)} detail="Private sessions awaiting focus or scheduling · global" icon={ClipboardList} tone="amber" wide />
    </div>
    <div className={styles.overviewGrid}>
      <section className={`role-card ${styles.panel}`}><div className={styles.sectionHeading}><div><h3>Revenue & orders</h3><p>{OVERVIEW_PERIODS[period]} · by purchase date</p></div><TrendingUp size={18} aria-hidden="true" /></div>{ready ? <TrendChart points={report.trend} /> : <div className={styles.chartMessage} role="status">{loading ? 'Loading revenue and orders…' : 'Chart unavailable. Try loading again.'}</div>}</section>
      <section className={`role-card ${styles.panel}`}><div className={styles.sectionHeading}><div><h3>Quick actions</h3><p>Your daily operations</p></div></div><div className={styles.quickActions}><QuickAction icon={ShoppingCart} title="Orders" detail="Review payments and receipts" onClick={() => onNavigate?.('orders')}/><QuickAction icon={CalendarDays} title="Mentoring Sessions" detail="Assign mentors and arrange sessions" onClick={() => onNavigate?.('sessions')}/><QuickAction icon={TrendingUp} title="Reports" detail="Explore sales performance" onClick={() => onNavigate?.('reports')}/></div></section>
    </div>
    <section className={`role-card ${styles.panel}`}><div className={styles.sectionHeading}><div><h3>Recent orders</h3><p>Latest 5 purchases · {OVERVIEW_PERIODS[period]} · WIB</p></div><button type="button" className={styles.textAction} onClick={() => onNavigate?.('orders')}>View all orders<ArrowUpRight size={15} aria-hidden="true"/></button></div><OrdersTable orders={error ? [] : orders} loading={loading} onDetail={openOrder} compact /></section>
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
function Metric({ label, value, detail, icon: Icon, tone = 'neutral', wide = false }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: 'neutral' | 'orange' | 'amber'; wide?: boolean }) {
  const groups = value.split('.')
  return <section className={styles.metric} data-tone={tone} data-wide={wide || undefined}><div className={styles.metricHead}><span>{label}</span><span className={styles.metricIcon}><Icon size={18} aria-hidden="true"/></span></div><strong className={styles.metricValue}>{groups.map((part, index) => <span key={index}>{part}{index < groups.length - 1 ? <>.<wbr/></> : null}</span>)}</strong><small>{detail}</small></section>
}
function QuickAction({ title, detail, icon: Icon, onClick }: { title: string; detail: string; icon: LucideIcon; onClick: () => void }) {
  return <button type="button" onClick={onClick}><span className={styles.actionIcon}><Icon size={18} aria-hidden="true"/></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight size={16} aria-hidden="true"/></button>
}
function TrendChart({ points }: { points: AdminCommerceReport['trend'] }) {
  if (!points.length) return <div className={styles.chartMessage}><TrendingUp aria-hidden="true" /><p>No orders in this period.</p></div>
  const max = Math.max(1, ...points.map(point => Number(point.revenue)))
  return <figure className={styles.chart} aria-label="Daily paid revenue and order counts">
    <figcaption><span><i aria-hidden="true"/>Paid revenue · IDR</span><span>Daily purchase buckets · UTC</span></figcaption>
    <div className={styles.chartAxis}><span>{formatRupiah(Math.max(...points.map(point => Number(point.revenue))))}</span><span>Order counts below each day</span></div>
    <div className={styles.chartScroll} role="region" aria-label="Daily revenue; scroll for more dates" tabIndex={0}><div className={styles.bars}>{points.map(point => {
      const date = displayDate(point.date)
      return <div className={styles.chartPoint} key={point.date} tabIndex={0} role="img" aria-label={`${date}: ${formatRupiah(point.revenue)} paid revenue, ${point.transactions} orders`}><div className={styles.barTrack}><i style={{ height: `${Number(point.revenue) / max * 100}%` }}/></div><span className={styles.barDate}>{date.replace(/ \d{4}$/, '')}</span><small>{point.transactions} {point.transactions === 1 ? 'order' : 'orders'}</small><span className={styles.chartTooltip} aria-hidden="true"><strong>{date}</strong>{formatRupiah(point.revenue)}<br/>{point.transactions} orders</span></div>
    })}</div></div>
    <p className={styles.chartNote}>Hover or focus a day to see revenue and order totals.</p>
  </figure>
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
  return <div className="ops-table-wrap" role="region" aria-label={compact ? "Recent orders table" : "Orders table"} tabIndex={0}><table className={`ops-table ${styles.ordersTable}`}><thead><tr><SortableTableHeader label="Order" sortKey="order" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Customer" sortKey="user" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Date" sortKey="date" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Item" sortKey="item" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Total" sortKey="total" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Order status" sortKey="order_status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Payment" sortKey="payment" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th aria-label="Action" /></tr></thead><tbody>{loading ? <tr><td colSpan={8}>Loading data…</td></tr> : visibleOrders.length === 0 ? <tr><td colSpan={8}>No matching orders.</td></tr> : visibleOrders.map(order => <tr key={order.order_id}><td><strong>#STR-{order.order_id.slice(0, 8).toUpperCase()}</strong></td><td>{order.user_email || '—'}</td><td>{displayDate(order.created_at)}</td><td><strong>{order.item_summary}</strong><small>{order.item_count} {order.item_count === 1 ? 'item' : 'items'}</small></td><td>{formatRupiah(order.total_amount)}</td><td><span className={`ops-status ops-status--${statusTone(order.order_status)}`}>{statusLabel(order.order_status)}</span></td><td><span className={`ops-status ops-status--${statusTone(order.payment?.status ?? order.order_status)}`}>{statusLabel(order.payment?.status ?? order.order_status)}</span></td><td><button type="button" className="ops-icon-button" onClick={() => onDetail(order)} aria-label={`View order details ${order.order_id}`} title="View order details"><Eye aria-hidden="true" size={17} /></button></td></tr>)}</tbody></table></div>
}

const OrderDialog = ({ dialogRef, order, onClose }: { dialogRef: RefObject<HTMLDialogElement | null>; order: AdminCommerceOrder | null; onClose: () => void }) => <dialog ref={dialogRef} className={`ops-dialog ${styles.orderDialog}`} aria-labelledby="admin-order-detail-title" onClose={onClose}>{order ? <div className={`ops-dialog__surface ${styles.orderSurface}`}><header className="ops-dialog__header"><div><h2 id="admin-order-detail-title">Order details</h2><p>#STR-{order.order_id.slice(0, 8).toUpperCase()} · {order.user_email} · {`${displayDate(order.created_at, true)} WIB`}</p></div><button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close order details"><X /></button></header><div className="ops-detail-grid"><div><span>Order status</span><strong>{statusLabel(order.order_status)}</strong></div><div><span>Payment status</span><strong>{statusLabel(order.payment?.status ?? order.order_status)}</strong></div><div><span>Paid</span><strong>{order.paid_at ? `${displayDate(order.paid_at, true)} WIB` : '—'}</strong></div><div><span>Total</span><strong>{formatRupiah(order.total_amount)}</strong></div></div><section className="ops-dialog__section"><h3>Item</h3>{order.items.map(item => <div className="ops-line-item" key={item.id}><div><strong>{item.name}</strong><span>{itemKindLabel(item.kind)} · Qty {item.quantity}</span></div><div><span>{formatRupiah(item.unitPrice)} / item</span><strong>{formatRupiah(item.subtotal)}</strong></div></div>)}</section>{order.payment ? <section className="ops-dialog__section"><h3>Payment</h3><dl className="ops-payment-detail"><div><dt>Provider</dt><dd>{order.payment.provider}</dd></div><div><dt>Provider order</dt><dd>{order.payment.providerOrderId}</dd></div><div><dt>Transaction reference</dt><dd>{order.payment.providerTransactionId ?? '—'}</dd></div><div><dt>Payment type</dt><dd>{order.payment.paymentType ? paymentMethodLabel(order.payment.paymentType) : '—'}</dd></div><div><dt>Provider status</dt><dd>{order.payment.providerStatus ?? order.payment.status}</dd></div><div><dt>Updated</dt><dd>{`${displayDate(order.payment.updatedAt, true)} WIB`}</dd></div></dl></section> : <p className="muted">No payment attempt has been recorded for this order.</p>}<div className="ops-total-row"><span>Total</span><strong>{formatRupiah(order.total_amount)}</strong></div>{order.order_status === 'paid' ? <PaymentReceiptActions key={order.order_id} orderId={order.order_id} /> : null}</div> : null}</dialog>
