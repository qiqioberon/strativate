'use client'

import { Download, Eye, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/commerce/money'
import { count, displayDate, paymentMethodLabel, statusLabel, type SalesComparison, type SalesReport, type SalesScope, type SalesTransaction, type SalesTransactionFilters, type SalesTransactionPage } from '@/lib/admin/sales-reporting'
import { TablePagination } from './table-pagination'
import { SalesExportDialog, SalesOrderDialog } from './sales-reporting-dialogs'
import styles from './sales-reporting.module.css'

const DEFAULT_FILTERS: SalesTransactionFilters = { query: '', status: '', payment: '', sort: 'created', direction: 'desc' }
type Props = SalesComparison & { from: string | null; to: string; scope: SalesScope; revision: number; validRange: boolean; validComparison: boolean; rangeLabel: string; comparisonLabel: string; report: SalesReport | null; onPrint: () => void }

export function SalesTransactions({ from, to, scope, compareMode, compareFrom, compareTo, revision, validRange, validComparison, rangeLabel, comparisonLabel, report, onPrint }: Props) {
  const client = useMemo(() => createClient(), [])
  const [filters, setFilters] = useState<SalesTransactionFilters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(0), [pageSize, setPageSize] = useState(25)
  const [storedData, setData] = useState<SalesTransactionPage>({ rows: [], total_count: 0 })
  const filterKey = JSON.stringify([from, to, scope, filters, page, pageSize])
  const [loadedFor, setLoadedFor] = useState('')
  const data = loadedFor === filterKey ? storedData : { rows: [], total_count: 0 }
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<SalesTransaction | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  function updateFilters(next: Partial<SalesTransactionFilters>) { setFilters(current => ({ ...current, ...next })); setPage(0) }
  useEffect(() => { setPage(0) }, [from, to, scope])
  useEffect(() => {
    if (!validRange) { setLoading(false); return }
    let current = true
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        const result = await client.rpc('list_admin_sales_transactions', { p_from: from ?? undefined, p_to: to, p_scope: scope, p_query: filters.query.trim(), p_status: filters.status, p_payment: filters.payment, p_sort: filters.sort, p_direction: filters.direction, p_limit: pageSize, p_offset: page * pageSize })
        if (!current) return
        if (result.error || !result.data) { setError('Unable to load transactions. Please try again.'); return }
        const next = result.data
        const lastPage = Math.max(0, Math.ceil(next.total_count / pageSize) - 1)
        if (page > lastPage) { setPage(lastPage); return }
        setData(next); setLoadedFor(filterKey)
      } catch { if (current) setError('Unable to load transactions. Check your connection and try again.') }
      finally { if (current) setLoading(false) }
    }, 300)
    return () => { current = false; clearTimeout(timer) }
  }, [client, from, to, scope, filters, page, pageSize, revision, retry, validRange, filterKey])

  const selectedId = selected?.order_id
  useEffect(() => {
    if (!selectedId) return
    let current = true
    void Promise.resolve(client.rpc('list_admin_sales_transactions', { p_query: selectedId, p_limit: 1 })).then(result => {
      if (!current || result.error || !result.data) return
      const order = result.data.rows.find(row => row.order_id === selectedId)
      if (order) setSelected(order)
    }).catch(() => { /* Keep the selected snapshot if detail refresh is unavailable. */ })
    return () => { current = false }
  }, [client, selectedId, revision])

  const methods = [...new Set([...(report?.payments.map(row => row.key) ?? []), filters.payment].filter(Boolean))]
  return <section className={styles.transactionSection}>
    <header className={styles.sectionHeader}><div><h3>Transactions</h3><p>{loadedFor === filterKey ? `${count(data.total_count)} records` : 'Loading record count…'} · full order amounts</p></div><div className={styles.actions}><button type="button" className={styles.button} onClick={onPrint} disabled={loading || !validRange || !validComparison || Boolean(error) || loadedFor !== filterKey}><Printer size={15} aria-hidden="true" />Print report</button><button type="button" className={`${styles.button} ${styles.primary}`} disabled={!validRange || !validComparison} onClick={() => setExportOpen(true)}><Download size={15} aria-hidden="true" />Export</button></div></header>
    <div className={styles.transactionFilters}>
      <label className={`${styles.field} ${styles.search}`}><span>Search transactions</span><input type="search" value={filters.query} maxLength={200} onChange={event => updateFilters({ query: event.target.value })} placeholder="Order, invoice, customer, product, discount…" /></label>
      <label className={styles.field}><span>Order status</span><select value={filters.status} onChange={event => updateFilters({ status: event.target.value })}><option value="">All statuses</option>{['paid', 'pending_payment', 'payment_failed', 'expired', 'cancelled'].map(key => <option key={key} value={key}>{statusLabel(key)}</option>)}</select></label>
      <label className={styles.field}><span>Payment method</span><select value={filters.payment} onChange={event => updateFilters({ payment: event.target.value })}><option value="">All methods</option>{methods.map(key => <option key={key} value={key}>{paymentMethodLabel(key)}</option>)}</select></label>
      <label className={styles.field}><span>Sort by</span><select value={`${filters.sort}:${filters.direction}`} onChange={event => { const [sort, direction] = event.target.value.split(':'); updateFilters({ sort: sort as SalesTransactionFilters['sort'], direction: direction as SalesTransactionFilters['direction'] }) }}>{[['created:desc', 'Newest created'], ['created:asc', 'Oldest created'], ['paid:desc', 'Newest paid'], ['paid:asc', 'Oldest paid'], ['net:desc', 'Highest value'], ['net:asc', 'Lowest value'], ['customer:asc', 'Customer A–Z'], ['status:asc', 'Status A–Z'], ['invoice:desc', 'Newest invoice']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={styles.field}><span>Per page</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
    </div>
    <p className={styles.methodNote}>Paid orders follow the payment date; other orders follow the creation date. Search and status filters apply only to the table and export.</p>
    {error ? <div className={styles.error} role="alert">{error}<button type="button" className={styles.button} onClick={() => setRetry(value => value + 1)}>Try again</button></div> : null}
    <div className={styles.tableWrap} aria-busy={loading} tabIndex={0} role="region" aria-label="Transaction table; scroll horizontally on smaller screens"><table className={styles.table}><caption className={styles.srOnly}>Shared Commerce transactions for {rangeLabel}</caption>
      <colgroup><col className={styles.invoiceColumn} /><col className={styles.customerColumn} /><col className={styles.dateColumn} /><col /><col className={styles.valueColumn} /><col className={styles.paymentColumn} /><col className={styles.statusColumn} /><col className={styles.detailColumn} /></colgroup>
      <thead><tr>{['Invoice / Order', 'Customer', 'Date', 'Item', 'Order amount', 'Payment', 'Status', 'Detail'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>
      {loading ? <tr><td colSpan={8} role="status">Loading transactions…</td></tr> : !data.rows.length ? <tr><td colSpan={8}>{filters.query || filters.status || filters.payment ? 'No transactions match these filters.' : 'No transactions in this period.'}</td></tr> : data.rows.map(order => <tr key={order.order_id}>
        <td><strong className={styles.cellText} title={order.invoice ?? undefined}>{order.invoice ?? 'No invoice yet'}</strong><small className={styles.cellText}>#STR-{order.order_id.slice(0, 8).toUpperCase()}</small></td>
        <td><strong className={styles.cellText} title={order.customer ?? undefined}>{order.customer ?? 'Customer'}</strong><small className={styles.cellText} title={order.email ?? undefined}>{order.email ?? '—'}</small></td>
        <td className={styles.dateCell}>{displayDate(order.status === 'paid' ? order.recognized_at : order.created_at)}<small>{order.status === 'paid' ? 'Paid' : 'Created'} · WIB</small></td>
        <td><strong className={styles.itemSummary} title={order.item_summary}>{order.item_summary}</strong><small>{count(order.item_count)} item</small></td>
        <td className={styles.valueCell}><span className={styles.valueLabel}>Net</span><strong className={styles.netValue}>{formatRupiah(order.net)}</strong><small><span>Gross</span><span className={styles.money}>{formatRupiah(order.gross)}</span></small><small><span>Discount</span><span className={styles.money}>{formatRupiah(order.discount)}</span></small>{order.discount_code ? <small className={styles.discountCode} title={order.discount_code}>{order.discount_code}</small> : null}</td>
        <td><strong className={styles.paymentMethod}>{paymentMethodLabel(order.payment?.method)}</strong><small>{order.payment ? statusLabel(order.payment.status) : 'No payment yet'}</small></td>
        <td><span className={styles.status} data-status={order.status}>{statusLabel(order.status)}</span></td>
        <td className={styles.detailCell}><button type="button" className={styles.iconButton} onClick={() => setSelected(order)} aria-label={`Detail ${order.invoice ?? `order ${order.order_id.slice(0, 8)}`}`}><Eye size={16} aria-hidden="true" /></button></td>
      </tr>)}
    </tbody></table></div>
    <div className={styles.pagination}><TablePagination language="en" page={page} pageSize={pageSize} totalItems={data.total_count} onPageChange={setPage} disabled={loading} label="Report transaction pages" /></div>
    <SalesOrderDialog order={selected} onClose={() => setSelected(null)} />
    <SalesExportDialog open={exportOpen && validRange && validComparison} onClose={() => setExportOpen(false)} from={from} to={to} scope={scope} compareMode={compareMode} compareFrom={compareFrom} compareTo={compareTo} filters={filters} rangeLabel={rangeLabel} comparisonLabel={comparisonLabel} />
  </section>
}
