'use client'

import { Info, Printer, RefreshCw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/commerce/money'
import {
  comparisonLabel, comparisonText, count, displayDate, isSalesDate, jakartaDate,
  previousSalesRange, salesDateRangeError, salesReportPresentation, shiftDate,
  type SalesComparisonMode, type SalesGranularity, type SalesReport, type SalesScope, type SalesView,
} from '@/lib/admin/sales-reporting'
import { SalesAnalytics } from './sales-reporting-analytics'
import { SalesMix, SalesPerformanceChart, SalesProductRanking, SalesStatusSnapshot, useSalesChartPrinting } from './sales-reporting-charts'
import { SalesTransactions } from './sales-reporting-transactions'
import styles from './sales-reporting.module.css'

const VIEWS: Array<[SalesView, string]> = [['summary', 'Summary'], ['analytics', 'Analytics'], ['transactions', 'Transactions & Export']]
const PRESETS = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom']]
const SCOPES: Array<[SalesScope, string]> = [['all', 'All sales'], ['digital', 'Digital Products'], ['private', 'Private Mentoring'], ['intensive', 'Intensive Mentoring']]
const COMPARISONS: Array<[SalesComparisonMode, string]> = [['none', 'No comparison'], ['previous', 'Previous period'], ['custom', 'Custom date range']]
function presetStart(preset: string, today: string) {
  return preset === 'year' ? `${today.slice(0, 4)}-01-01` : shiftDate(today, -(Number(preset) - 1))
}

export function AdminSalesReporting() {
  useSalesChartPrinting()
  const client = useMemo(() => createClient(), [])
  const router = useRouter(), pathname = usePathname(), params = useSearchParams()
  const today = jakartaDate()
  const rawView = params.get('reportView')
  const view = VIEWS.some(([key]) => key === rawView) ? rawView as SalesView : 'summary'
  const rawPreset = params.get('reportRange')
  const preset = PRESETS.some(([key]) => key === rawPreset) ? rawPreset! : '30'
  const rawScope = params.get('reportScope')
  const scope: SalesScope = SCOPES.some(([key]) => key === rawScope) ? rawScope as SalesScope : 'all'
  // Empty custom inputs stay empty in the URL; they never silently become presets.
  const from = preset === 'all' ? null : params.get('reportFrom') ?? (preset === 'custom' ? '' : presetStart(preset, today))
  const to = params.get('reportTo') ?? (preset === 'custom' ? '' : today)
  const rangeError = salesDateRangeError(from, to)
  const validRange = !rangeError
  const rawCompareMode = params.get('reportCompareMode')
  const selectedCompareMode: SalesComparisonMode = COMPARISONS.some(([key]) => key === rawCompareMode)
    ? rawCompareMode as SalesComparisonMode : params.get('reportCompare') === '0' ? 'none' : 'previous'
  const compareMode = preset === 'all' ? 'none' : selectedCompareMode
  const compareFrom = compareMode === 'custom' ? params.get('reportCompareFrom') ?? '' : null
  const compareTo = compareMode === 'custom' ? params.get('reportCompareTo') ?? '' : null
  const previousRange = validRange && from ? previousSalesRange(from, to) : null
  const compareError = compareMode === 'custom' ? salesDateRangeError(compareFrom, compareTo ?? '', true)
    : compareMode === 'previous' && previousRange && !isSalesDate(previousRange.from)
      ? 'The previous period is outside the supported dates. Choose a custom range or no comparison.' : ''
  const validComparison = !compareError
  const [granularity, setGranularity] = useState<SalesGranularity>('auto')
  // Interval changes keep chart controls mounted while the same financial range refreshes.
  const filterKey = JSON.stringify([from, to, scope, compareMode, compareFrom, compareTo])
  const [storedReport, setReport] = useState<SalesReport | null>(null)
  const [loadedFor, setLoadedFor] = useState('')
  const report = validRange && validComparison && loadedFor === filterKey ? storedReport : null
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const invalidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const printedAt = useRef<HTMLSpanElement>(null)
  const methodology = useRef<HTMLDetailsElement>(null)

  function updateParams(values: Record<string, string>, push = false) {
    const next = new URLSearchParams(params.toString())
    next.delete('view'); next.delete('cartView'); next.delete('reportCompare')
    next.set('reportView', view)
    next.set('reportRange', preset); next.set('reportFrom', from ?? ''); next.set('reportTo', to)
    next.set('reportCompareMode', compareMode)
    Object.entries(values).forEach(([key, value]) => next.set(key, value))
    router[push ? 'push' : 'replace'](`${pathname}?${next.toString()}`, { scroll: false })
  }
  function choosePreset(value: string) {
    updateParams({ reportRange: value, reportFrom: value === 'all' ? '' : value === 'custom' ? from ?? '' : presetStart(value, today), reportTo: value === 'custom' ? to : today })
  }
  function chooseComparison(value: SalesComparisonMode) {
    updateParams({ reportCompareMode: value, ...(value === 'custom' ? {
      reportCompareFrom: params.get('reportCompareFrom') ?? previousRange?.from ?? '',
      reportCompareTo: params.get('reportCompareTo') ?? previousRange?.to ?? '',
    } : {}) })
  }

  useEffect(() => {
    if (!validRange || !validComparison) { setLoading(false); setError(''); return }
    let current = true
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        const result = await client.rpc('get_admin_sales_report_v2', {
          p_from: from ?? undefined, p_to: to, p_scope: scope, p_compare_mode: compareMode,
          p_compare_from: compareFrom ?? undefined, p_compare_to: compareTo ?? undefined, p_granularity: granularity,
        })
        if (!current) return
        if (result.error || !result.data) setError('Unable to load the report. Please try again.')
        else { setReport(salesReportPresentation(result.data)); setLoadedFor(filterKey) }
      } catch {
        if (current) setError('Unable to load the report. Check your connection and try again.')
      } finally { if (current) setLoading(false) }
    }, 250)
    return () => { current = false; clearTimeout(timer) }
  }, [client, from, to, scope, compareMode, compareFrom, compareTo, granularity, revision, validRange, validComparison, filterKey])

  useOperationalInvalidation(['commerce'], () => {
    if (invalidationTimer.current) clearTimeout(invalidationTimer.current)
    invalidationTimer.current = setTimeout(() => setRevision(value => value + 1), 400)
  })
  useEffect(() => () => { if (invalidationTimer.current) clearTimeout(invalidationTimer.current) }, [])
  useEffect(() => {
    const cleanup = () => { delete document.body.dataset.salesReportPrint }
    window.addEventListener('afterprint', cleanup)
    return () => { window.removeEventListener('afterprint', cleanup); cleanup() }
  }, [])
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (methodology.current && event.target instanceof Node && !methodology.current.contains(event.target)) methodology.current.open = false
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  function printReport() {
    if (!validRange || !validComparison) return
    if (printedAt.current) printedAt.current.textContent = displayDate(new Date().toISOString(), true)
    document.body.dataset.salesReportPrint = 'true'
    window.print()
  }

  const rangeLabel = validRange ? `${from ? displayDate(from) : 'All time'} – ${displayDate(to)}` : 'Invalid reporting period'
  const comparisonRange = compareMode === 'custom' ? { from: compareFrom, to: compareTo } : previousRange
  const comparisonSummary = compareMode === 'none' ? 'No comparison'
    : !validComparison || !validRange ? 'Invalid comparison period'
      : `${compareMode === 'previous' ? 'Previous period' : 'Custom date range'}: ${displayDate(comparisonRange?.from ?? null)} – ${displayDate(comparisonRange?.to ?? null)}`
  const scopeLabel = SCOPES.find(([key]) => key === scope)![1]
  return <div className={styles.workspace} data-sales-report>
    <header className={styles.pageHeader}>
      <div><h2>Reports</h2></div>
      {view !== 'transactions' ? <button type="button" className={styles.button} onClick={printReport} disabled={loading || !report || !validRange || !validComparison || Boolean(error)}><Printer size={15} aria-hidden="true" />Print report</button> : null}
    </header>
    <div className={styles.printMetadata}><strong>{rangeLabel} · {scopeLabel} · WIB</strong><span>{comparisonSummary}</span><span>Printed: <span ref={printedAt} /> WIB</span><span>Paid sales follow the payment date; order statuses follow the creation date. Gross − discount = net.</span>{view === 'transactions' ? <span>Only the current transaction page is shown. Export to include all matching data.</span> : null}</div>
    <nav className={styles.tabs} role="tablist" aria-label="Report views">
      {VIEWS.map(([key, label], index) => <button key={key} type="button" id={`report-tab-${key}`} role="tab" aria-selected={view === key} aria-controls={`report-panel-${key}`} tabIndex={view === key ? 0 : -1} onClick={() => updateParams({ reportView: key }, true)} onKeyDown={event => {
        let next: number | null = null
        if (event.key === 'ArrowRight') next = (index + 1) % VIEWS.length
        if (event.key === 'ArrowLeft') next = (index + VIEWS.length - 1) % VIEWS.length
        if (event.key === 'Home') next = 0
        if (event.key === 'End') next = VIEWS.length - 1
        if (next === null) return
        event.preventDefault(); document.getElementById(`report-tab-${VIEWS[next][0]}`)?.focus(); updateParams({ reportView: VIEWS[next][0] }, true)
      }}>{label}</button>)}
    </nav>
    <div className={styles.filterBar}>
      <label className={styles.field}><span>Period</span><select value={preset} onChange={event => choosePreset(event.target.value)}>{PRESETS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={styles.field}><span>From</span>{preset === 'all' ? <input type="text" value="All time" disabled aria-label="From: all time" /> : <input type="date" value={from ?? ''} aria-invalid={!validRange} aria-describedby={rangeError ? 'report-range-error' : undefined} onChange={event => updateParams({ reportRange: 'custom', reportFrom: event.target.value, reportTo: to })} />}</label>
      <label className={styles.field}><span>To</span><input type="date" value={to} aria-invalid={!validRange} aria-describedby={rangeError ? 'report-range-error' : undefined} onChange={event => updateParams({ reportRange: preset === 'all' ? 'all' : 'custom', reportFrom: from ?? '', reportTo: event.target.value })} /></label>
      <label className={styles.field}><span>Business scope</span><select value={scope} onChange={event => updateParams({ reportScope: event.target.value })}>{SCOPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={styles.field}><span>Compare with</span><select value={compareMode} disabled={preset === 'all'} onChange={event => chooseComparison(event.target.value as SalesComparisonMode)}>{COMPARISONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button type="button" className={styles.iconButton} aria-label="Refresh report" title="Refresh report" disabled={loading || !validRange || !validComparison} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true" /></button>
      {compareMode === 'custom' ? <div className={styles.comparisonFields}>
        <label className={styles.field}><span>Comparison from</span><input type="date" value={compareFrom ?? ''} aria-invalid={!validComparison} aria-describedby={compareError ? 'report-comparison-error' : undefined} onChange={event => updateParams({ reportCompareFrom: event.target.value })} /></label>
        <label className={styles.field}><span>Comparison to</span><input type="date" value={compareTo ?? ''} aria-invalid={!validComparison} aria-describedby={compareError ? 'report-comparison-error' : undefined} onChange={event => updateParams({ reportCompareTo: event.target.value })} /></label>
      </div> : null}
    </div>
    <div className={styles.rangeMetadata}>
      <div className={styles.metadataLine}><span>{rangeLabel} · WIB{report ? ` · ${report.range.granularity === 'day' ? 'Daily' : report.range.granularity === 'week' ? 'Weekly' : 'Monthly'}` : ''}</span>
        <details ref={methodology} className={styles.methodology} onKeyDown={event => { if (event.key === 'Escape' && methodology.current) { methodology.current.open = false; methodology.current.querySelector('summary')?.focus() } }}><summary><Info size={13} aria-hidden="true" />How totals are calculated</summary><div className={styles.methodologyPanel}><p>Sales include paid orders by payment date. Order statuses are counted by creation date. {scope !== 'all' ? 'KPIs and analytics total items in the selected scope; the transaction table shows full order amounts.' : 'Net revenue = subtotal − discount.'} Missing historical subtotals use net amount + discount. Repeat customers have more than one paid order by the end of the period. {report?.legacy_paid_orders ? `${count(report.legacy_paid_orders)} historical orders use the paid payment-attempt date, then the order update date when a payment date is unavailable.` : ''} All times use Asia/Jakarta.</p></div></details>
      </div>
      <p className={styles.comparisonNote}>{comparisonSummary}{preset === 'all' ? ' · Comparison requires a defined start date.' : ''}</p>
    </div>
    {rangeError ? <p id="report-range-error" className={styles.error} role="alert">{rangeError}</p> : null}
    {compareError ? <p id="report-comparison-error" className={styles.error} role="alert">{compareError}</p> : null}
    {error && validRange && validComparison ? <div className={styles.error} role="alert">{error}<button type="button" className={styles.button} onClick={() => setRevision(value => value + 1)}>Try again</button></div> : null}
    {loading && validRange && validComparison ? <p className={styles.loading} role="status">{report ? 'Refreshing report…' : 'Loading sales report…'}</p> : null}
    {VIEWS.map(([panel]) => <section key={panel} id={`report-panel-${panel}`} role="tabpanel" aria-labelledby={`report-tab-${panel}`} aria-busy={loading} tabIndex={0} className={styles.panel} hidden={view !== panel}>
      {view === panel ? <>
      {view === 'transactions' ? <SalesTransactions from={from} to={to} scope={scope} compareMode={compareMode} compareFrom={compareFrom} compareTo={compareTo} revision={revision} validRange={validRange} validComparison={validComparison} rangeLabel={rangeLabel} comparisonLabel={comparisonSummary} report={report} onPrint={printReport} /> : report ? view === 'analytics' ? <SalesAnalytics report={report} granularity={granularity} onGranularityChange={setGranularity} /> : <>
        <SalesKpis report={report} />
        {!report.totals.orders ? <p className={styles.empty}>No paid orders in this period.</p> : null}
        <div className={styles.summaryMain}><SalesPerformanceChart report={report} granularity={granularity} onGranularityChange={setGranularity} /><SalesMix report={report} /></div>
        <div className={styles.summaryBottom}><SalesProductRanking products={report.products} compact /><SalesStatusSnapshot report={report} /></div>
      </> : !loading && !error && validRange && validComparison ? <p className={styles.empty}>No transactions in this period.</p> : null}
      </> : null}
    </section>)}
  </div>
}

function SalesKpis({ report }: { report: SalesReport }) {
  const cards = [
    { key: 'net' as const, label: 'Net revenue', note: 'Paid amount after discounts', money: true },
    { key: 'gross' as const, label: 'Gross sales', note: 'Subtotal before discounts', money: true },
    { key: 'discount' as const, label: 'Discount', note: 'Discounts on paid orders', money: true },
    { key: 'orders' as const, label: 'Paid orders', note: `${count(report.totals.units)} items sold`, money: false },
    { key: 'aov' as const, label: 'Average order value', note: 'Net revenue / paid orders', money: true },
    { key: 'buyers' as const, label: 'Unique customers', note: `${count(report.customers.repeat)} repeat customers`, money: false },
  ]
  const wideValue = cards.some(card => (card.money ? formatRupiah(Math.round(report.totals[card.key])) : count(report.totals[card.key])).length > 17)
  return <div className={styles.kpis} data-wide-value={wideValue}>{cards.map(card => {
    const value = report.totals[card.key], previous = report.previous?.[card.key]
    const tone = card.key === 'discount' || previous === undefined || value === previous ? '' : value > previous ? styles.increase : styles.decrease
    return <article key={card.key} className={styles.kpi}><span>{card.label}</span><strong>{card.money ? formatRupiah(Math.round(value)) : count(value)}</strong><small>{card.note}</small>{previous !== undefined ? <small className={tone}>{comparisonText(value, previous, comparisonLabel(report.range))}</small> : null}</article>
  })}</div>
}
