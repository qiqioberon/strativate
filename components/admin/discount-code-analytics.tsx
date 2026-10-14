'use client'

import { Download, ExternalLink, RefreshCw, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DISCOUNT_CATEGORY_LABELS, DISCOUNT_EXPORT_LIMIT_MESSAGE, discountRpcFilters, discountTransactionHref, type DiscountFilters, type DiscountReport, type DiscountUsagePage } from '@/lib/admin/discount-reporting'
import { count, displayDate, jakartaDate, salesDateRangeError } from '@/lib/admin/sales-reporting'
import { formatRupiah } from '@/lib/commerce/money'
import { createClient } from '@/lib/supabase/client'
import type { DiscountCode } from '@/lib/supabase/database.types'
import { TablePagination } from './table-pagination'
import styles from './discount-code-analytics.module.css'

const PAGE_SIZE = 25
function categoryNames(categories: Array<keyof typeof DISCOUNT_CATEGORY_LABELS>) { return categories.map(category => DISCOUNT_CATEGORY_LABELS[category]).join(', ') || 'Unavailable' }

function UsageDetail({ filters, code, revision, onClose }: { filters: DiscountFilters; code: { id: string; label: string }; revision: number; onClose: () => void }) {
  const client = useMemo(() => createClient(), [])
  const filtersKey = JSON.stringify(filters)
  const [paging, setPaging] = useState({ filtersKey, page: 0 })
  const page = paging.filtersKey === filtersKey ? paging.page : 0
  const setPage = useCallback((next: number) => { setPaging({ filtersKey, page: next }) }, [filtersKey])
  const [response, setResponse] = useState<{ key: string; data: DiscountUsagePage } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const [retry, setRetry] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const key = JSON.stringify([filters, code.id, page, revision, retry])
  const data = response?.key === key ? response.data : null
  const error = failure?.key === key ? failure.message : ''
  const loading = !data && !error
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'nearest' }) }, [])
  useEffect(() => {
    let current = true
    const abort = new AbortController()
    void Promise.resolve(client.rpc('list_admin_discount_usage', { ...discountRpcFilters({ ...filters, codeId: code.id }), p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }).abortSignal(abort.signal)).then(result => {
      if (!current) return
      if (result.error || !result.data) { setFailure({ key, message: 'Unable to load usage details. Try again.' }); return }
      const lastPage = Math.max(0, Math.ceil(result.data.total_count / PAGE_SIZE) - 1)
      if (page > lastPage) { setPage(lastPage); return }
      setResponse({ key, data: result.data })
    }).catch(() => { if (current) setFailure({ key, message: 'Unable to load usage details. Check your connection and try again.' }) })
    return () => { current = false; abort.abort() }
  }, [client, filters, code.id, page, revision, retry, key, setPage])
  return <section id="discount-usage-panel" className={styles.panel} aria-labelledby="discount-usage-heading">
    <header className={styles.heading}><div><h3 id="discount-usage-heading" ref={heading} tabIndex={-1}>Usage of {code.label}</h3><p>{data ? `${count(data.total_count)} paid redemptions` : 'Paid redemptions'} · newest first · WIB</p></div><button type="button" className={styles.button} onClick={onClose}><X size={15} aria-hidden="true" />Close detail</button></header>
    <p className={styles.note}>Institution and referral source come from the customer’s recorded profile. Their institution does not establish a commercial partnership.</p>
    {error ? <p className={styles.error} role="alert">{error}<button type="button" className={styles.button} onClick={() => setRetry(value => value + 1)}>Retry</button></p> : null}
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="Discount usage table; scroll horizontally on small screens" aria-busy={loading}><table className={`${styles.table} ${styles.usageTable}`}>
      <caption className={styles.srOnly}>Paid transactions that used {code.label}, including actual customer origin and order amounts.</caption>
      <thead><tr><th scope="col">Customer / email</th><th scope="col">Institution / referral</th><th scope="col">Order / invoice</th><th scope="col">Purchased (WIB)</th><th scope="col">Products / programs</th><th scope="col" className={styles.numeric}>Discount</th><th scope="col" className={styles.numeric}>Paid amount</th><th scope="col">Transaction</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={8} role="status">Loading usage…</td></tr> : !data?.rows.length ? <tr><td colSpan={8}>{error ? 'Usage data is unavailable.' : 'No paid redemptions match these filters.'}</td></tr> : data.rows.map(row => <tr key={row.order_id}>
        <td><strong>{row.customer ?? 'Unavailable'}</strong><small>{row.email ?? 'Unavailable'}</small></td>
        <td><strong>{row.institution ?? 'Unavailable'}</strong><small>Referral: {row.referral ?? 'Unavailable'}</small></td>
        <td><strong>{row.invoice ?? 'Invoice unavailable'}</strong><small>{row.order_id}</small><small>Applied code: {row.code}</small></td>
        <td>{displayDate(row.purchased_at, true)}{row.legacy_paid ? <small>Legacy paid-time fallback</small> : null}</td>
        <td>{row.products.length ? <ul className={styles.products}>{row.products.map(product => <li key={product.id}>{product.name}</li>)}</ul> : 'Unavailable'}</td>
        <td className={styles.numeric}>{formatRupiah(row.discount)}</td><td className={styles.numeric}><strong>{formatRupiah(row.net)}</strong><small>Gross {formatRupiah(row.gross)}</small></td>
        <td><Link href={discountTransactionHref(row.order_id)} className={styles.link}>View order<ExternalLink size={13} aria-hidden="true" /></Link></td>
      </tr>)}</tbody>
    </table></div>
    <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={data?.total_count ?? 0} onPageChange={setPage} disabled={loading} language="en" label="Discount usage pages" />
  </section>
}

function UsageTrend({ report }: { report: DiscountReport }) {
  const rows = report.trend
  const max = rows.reduce((highest, row) => Math.max(highest, row.redemptions), 1)
  const barWidth = Math.min(10, 600 / Math.max(1, rows.length))
  const first = rows.length ? Date.parse(`${rows[0].date}T00:00:00Z`) : 0
  const last = rows.length ? Date.parse(`${rows[rows.length - 1].date}T00:00:00Z`) : 0
  const x = (date: string) => first === last ? 360 : 34 + (Date.parse(`${date}T00:00:00Z`) - first) / (last - first) * 652
  const y = (value: number) => 168 - value / max * 135
  return <section className={styles.panel} aria-labelledby="discount-trend-heading"><header className={styles.heading}><div><h3 id="discount-trend-heading">Usage trend</h3><p>Paid redemptions per {report.granularity} · Asia/Jakarta</p></div></header>
    {!rows.length ? <p className={styles.empty}>No paid redemptions in this period.</p> : <>
      <svg className={styles.chart} viewBox="0 0 720 206" role="img" aria-labelledby="discount-trend-title discount-trend-description">
        <title id="discount-trend-title">Successful discount redemptions over time</title><desc id="discount-trend-description">{rows.length} periods with usage. Maximum {max} paid redemptions. Exact counts and dates are available in the trend data table.</desc>
        {[0, .5, 1].map(value => <g key={value}><line x1="34" x2="686" y1={y(value * max)} y2={y(value * max)} className={styles.gridline} /><text x="28" y={y(value * max) + 4} textAnchor="end" className={styles.chartLabel}>{count(Math.round(value * max))}</text></g>)}
        {rows.map(row => <rect key={row.date} x={x(row.date) - barWidth / 2} y={y(row.redemptions)} width={barWidth} height={168 - y(row.redemptions)} rx="1" className={styles.bar}><title>{displayDate(row.date)}: {count(row.redemptions)} paid redemptions</title></rect>)}
        <text x="34" y="194" className={styles.chartLabel}>{displayDate(rows[0].date)}</text><text x="686" y="194" textAnchor="end" className={styles.chartLabel}>{displayDate(rows[rows.length - 1].date)}</text>
      </svg>
      <details className={styles.trendDetails}><summary>View trend data</summary><div className={styles.scroll} tabIndex={0} role="region" aria-label="Usage trend data"><table className={styles.table}><caption className={styles.srOnly}>Only periods containing paid usage are listed; customers are distinct within each period.</caption><thead><tr><th scope="col">Period starting</th><th scope="col">Redemptions</th><th scope="col">Customers</th><th scope="col">Discount</th><th scope="col">Net value</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><td>{displayDate(row.date)}</td><td>{count(row.redemptions)}</td><td>{count(row.customers)}</td><td>{formatRupiah(row.discount)}</td><td>{formatRupiah(row.net)}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>
}

export function DiscountCodeAnalytics({ codes }: { codes: DiscountCode[] }) {
  const client = useMemo(() => createClient(), [])
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<DiscountFilters>(() => ({
    from: searchParams.get('discountFrom') || null,
    to: searchParams.get('discountTo') ?? jakartaDate(),
    codeId: searchParams.get('discountCode') || null,
    campaign: searchParams.get('discountCampaign') ?? '',
    partner: searchParams.get('discountPartner') ?? '',
    category: (searchParams.get('discountCategory') ?? 'all') as DiscountFilters['category'],
  }))
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [response, setResponse] = useState<{ key: string; report: DiscountReport } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null)
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const exportAbort = useRef<AbortController | null>(null)
  const rangeError = salesDateRangeError(filters.from, filters.to)
  const requestKey = JSON.stringify([filters, page, revision])
  const report = response?.key === requestKey ? response.report : null
  const error = failure?.key === requestKey ? failure.message : ''
  const loading = !rangeError && !report && !error
  const selectedKey = selected?.id ?? ''
  function updateFilters(next: Partial<DiscountFilters>) {
    const nextFilters = { ...filters, ...next }
    setFilters(nextFilters); setPage(0); setExportError('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('reportView'); params.set('discountView', 'analytics')
    params.set('discountFrom', nextFilters.from ?? ''); params.set('discountTo', nextFilters.to)
    if (nextFilters.codeId) params.set('discountCode', nextFilters.codeId); else params.delete('discountCode')
    if (nextFilters.campaign) params.set('discountCampaign', nextFilters.campaign); else params.delete('discountCampaign')
    if (nextFilters.partner) params.set('discountPartner', nextFilters.partner); else params.delete('discountPartner')
    if (nextFilters.category !== 'all') params.set('discountCategory', nextFilters.category); else params.delete('discountCategory')
    router.replace(`${pathname}?${params}`, { scroll: false })
    exportAbort.current?.abort(); setExporting(false)
  }
  useEffect(() => () => { exportAbort.current?.abort() }, [])
  useEffect(() => {
    if (rangeError) return
    let current = true
    const abort = new AbortController()
    const timer = setTimeout(() => {
      void Promise.resolve(client.rpc('get_admin_discount_report', { ...discountRpcFilters(filters), p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }).abortSignal(abort.signal)).then(result => {
        if (!current) return
        if (result.error || !result.data) { setFailure({ key: requestKey, message: 'Unable to load discount analytics. Refresh and try again.' }); return }
        const lastPage = Math.max(0, Math.ceil(result.data.total_count / PAGE_SIZE) - 1)
        if (page > lastPage) { setPage(lastPage); return }
        setResponse({ key: requestKey, report: result.data })
      }).catch(() => { if (current) setFailure({ key: requestKey, message: 'Unable to load discount analytics. Check your connection and try again.' }) })
    }, 250)
    return () => { current = false; clearTimeout(timer); abort.abort() }
  }, [client, filters, page, revision, rangeError, requestKey])
  async function exportUsage() {
    if (exporting || rangeError) return
    const abort = new AbortController()
    exportAbort.current = abort
    setExporting(true); setExportError('')
    try {
      const result = await fetch('/api/admin/discount-reporting/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...filters, format: exportFormat }), signal: abort.signal })
      if (!result.ok) { const detail = await result.json().catch(() => null); throw new Error(detail?.message ?? 'Unable to export discount usage. Try again.') }
      const blob = await result.blob()
      if (abort.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `strativate-discount-usage-${filters.from ?? 'all'}_${filters.to}.${exportFormat}`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (caught) { if (!abort.signal.aborted) setExportError(caught instanceof Error ? caught.message : 'Unable to export discount usage. Try again.') }
    finally { if (exportAbort.current === abort && !abort.signal.aborted) setExporting(false) }
  }
  return <div className={styles.workspace}>
    <div className={styles.filters}>
      <label className={styles.field}>From (WIB)<input type="date" value={filters.from ?? ''} onChange={event => updateFilters({ from: event.target.value || null })} /><small>Empty means all time.</small></label>
      <label className={styles.field}>Through (WIB)<input type="date" required value={filters.to} onChange={event => updateFilters({ to: event.target.value })} /><small>Includes the entire date.</small></label>
      <label className={styles.field}>Code<select value={filters.codeId ?? ''} onChange={event => { updateFilters({ codeId: event.target.value || null }); setSelected(null) }}><option value="">All codes</option>{filters.codeId && !codes.some(code => code.id === filters.codeId) ? <option value={filters.codeId}>{selected?.id === filters.codeId ? selected.label : filters.codeId}</option> : null}{codes.map(code => <option value={code.id} key={code.id}>{code.code}</option>)}</select></label>
      <label className={styles.field}>Campaign<input type="search" value={filters.campaign} maxLength={200} placeholder="Contains campaign name" onChange={event => updateFilters({ campaign: event.target.value })} /></label>
      <label className={styles.field}>Collaboration / partner<input type="search" value={filters.partner} maxLength={200} placeholder="Contains recorded label" onChange={event => updateFilters({ partner: event.target.value })} /></label>
      <label className={styles.field}>Applicable category<select value={filters.category} onChange={event => updateFilters({ category: event.target.value as DiscountFilters['category'] })}><option value="all">All categories</option>{Object.entries(DISCOUNT_CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </div>
    <div className={styles.toolbar}><p className={styles.note}>Paid orders only · inclusive Asia/Jakarta dates · full order amounts</p><button type="button" className={styles.button} onClick={() => setRevision(value => value + 1)} disabled={loading || exporting || Boolean(rangeError)}><RefreshCw size={15} aria-hidden="true" />Refresh</button></div>
    {rangeError || error ? <p className={styles.error} role="alert">{rangeError || error}{error && !rangeError ? <button type="button" className={styles.button} onClick={() => setRevision(value => value + 1)}>Retry</button> : null}</p> : null}
    {loading ? <p className={styles.empty} role="status">Loading discount analytics…</p> : null}
    <details className={styles.methodology}><summary>Metric definitions and attribution</summary><p>A successful redemption is one paid order with a redeemed discount reservation. Customers count unique buyer accounts across all matching orders. Gross, discount and net use the order’s saved amounts; gross retains the shared sales-report fallback for historical zero subtotals. Editing a code never changes historical prices.</p><p>Dates use the shared sales-report paid date, including its existing fallback when paid_at is missing. Campaign, collaboration and category filters use current code metadata; they do not reconstruct historical campaign attribution. Category filters retain each matching order’s complete value and all purchased items.</p></details>
    {report ? <>
      <div className={styles.metrics}>
        <article><span>Successful redemptions</span><strong>{count(report.summary.redemptions)}</strong><small>Distinct paid orders</small></article>
        <article><span>Distinct customers</span><strong>{count(report.summary.customers)}</strong><small>Unique buyer accounts</small></article>
        <article><span>Total discount</span><strong>{formatRupiah(report.summary.discount)}</strong><small>From matching paid orders</small></article>
        <article><span>Gross order value</span><strong>{formatRupiah(report.summary.gross)}</strong><small>Before discount; full orders</small></article>
        <article><span>Net paid order value</span><strong>{formatRupiah(report.summary.net)}</strong><small>Saved paid totals; full orders</small></article>
      </div>
      {report.summary.legacy_paid > 0 ? <p className={styles.note}>{count(report.summary.legacy_paid)} orders use the existing legacy paid-time fallback.</p> : null}
      <div className={styles.highlights}><UsageTrend report={report} /><section className={styles.panel}><h3>Most-used codes</h3>{report.most_used.length ? <ol className={styles.topCodes}>{report.most_used.map(code => <li key={code.code_id}><button type="button" className={styles.link} onClick={() => setSelected({ id: code.code_id, label: code.code })}>{code.code}</button><span>{count(code.redemptions)} paid redemptions</span></li>)}</ol> : <p className={styles.empty}>No codes have paid usage in this period.</p>}</section></div>
      <section className={styles.panel}><header className={styles.heading}><div><h3>Code performance</h3><p>{count(report.total_count)} matching codes · sorted by paid usage</p></div></header>
        <div className={styles.scroll} tabIndex={0} role="region" aria-label="Code performance table; scroll horizontally on small screens"><table className={`${styles.table} ${styles.performanceTable}`}><caption className={styles.srOnly}>Code performance for paid transactions in the selected filters.</caption>
          <thead><tr><th scope="col">Code / campaign</th><th scope="col">Applicable categories</th><th scope="col" className={styles.numeric}>Paid redemptions</th><th scope="col" className={styles.numeric}>Customers</th><th scope="col" className={styles.numeric}>Discount</th><th scope="col" className={styles.numeric}>Gross value</th><th scope="col" className={styles.numeric}>Net value</th><th scope="col">First / latest (WIB)</th><th scope="col">Usage</th></tr></thead>
          <tbody>{!report.rows.length ? <tr><td colSpan={9}>No codes match these filters.</td></tr> : report.rows.map(code => <tr key={code.code_id} data-selected={selected?.id === code.code_id}>
            <td><button type="button" className={styles.link} aria-label={`Filter analytics to ${code.code}`} onClick={() => { updateFilters({ codeId: code.code_id }); setSelected({ id: code.code_id, label: code.code }) }}>{code.code}</button>{code.description ? <small>{code.description}</small> : null}<small>Campaign: {code.campaign ?? 'Unavailable'}</small><small>Collaboration: {code.partner ?? 'Unavailable'}</small></td>
            <td>{categoryNames(code.categories)}{code.scope === 'selected_digital_products' ? <small>Selected Digital Products</small> : null}</td>
            <td className={styles.numeric}>{count(code.redemptions)}</td><td className={styles.numeric}>{count(code.customers)}</td><td className={styles.numeric}>{formatRupiah(code.discount)}</td><td className={styles.numeric}>{formatRupiah(code.gross)}</td><td className={styles.numeric}><strong>{formatRupiah(code.net)}</strong></td>
            <td>{code.first_at ? <><span>{displayDate(code.first_at, true)}</span><small>Latest: {displayDate(code.latest_at, true)}</small></> : 'No paid usage'}</td>
            <td><button type="button" className={styles.button} aria-expanded={selected?.id === code.code_id} aria-controls={selected?.id === code.code_id ? 'discount-usage-panel' : undefined} onClick={() => setSelected(current => current?.id === code.code_id ? null : { id: code.code_id, label: code.code })}>View usage</button></td>
          </tr>)}</tbody>
        </table></div>
        <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={report.total_count} onPageChange={setPage} language="en" label="Code performance pages" />
      </section>
    </> : null}
    {selected && !rangeError ? <UsageDetail key={selectedKey} code={selected} filters={filters} revision={revision} onClose={() => setSelected(null)} /> : null}
    <section className={styles.export}><div><h3>Export internal usage</h3><p>{DISCOUNT_EXPORT_LIMIT_MESSAGE}</p><small>Exports follow the filters above. To export one code, choose it in the Code filter.</small></div><div className={styles.exportActions}><label className={styles.field}><span className={styles.srOnly}>Export format</span><select value={exportFormat} onChange={event => setExportFormat(event.target.value as 'xlsx' | 'csv')} disabled={exporting}><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV (.csv)</option></select></label><button type="button" className={`${styles.button} ${styles.primary}`} disabled={exporting || loading || Boolean(rangeError) || Boolean(error)} onClick={() => void exportUsage()}><Download size={15} aria-hidden="true" />{exporting ? 'Preparing export…' : 'Export usage'}</button></div></section>
    {exportError ? <p className={styles.error} role="alert">{exportError}</p> : null}
  </div>
}
