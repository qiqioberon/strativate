'use client'

import { useId, useState, type KeyboardEvent } from 'react'

import {
  CATEGORY_LABELS, SALES_COLORS, count, paymentMethodLabel, percent, statusLabel,
  type SalesBreakdown, type SalesGranularity, type SalesReport,
} from '@/lib/admin/sales-reporting'
import { formatRupiah } from '@/lib/commerce/money'
import {
  SalesBreakdownChart, SalesFinancialComparison, SalesOrderVolumeChart,
  SalesPerformanceChart, SalesProductRanking,
} from './sales-reporting-charts'
import styles from './sales-reporting-charts.module.css'

const VIEWS = [
  { key: 'performance', label: 'Sales Performance' },
  { key: 'products', label: 'Products & Mentoring' },
  { key: 'payments', label: 'Payments & Discounts' },
] as const
type AnalyticsView = typeof VIEWS[number]['key']
type ProductFocus = 'all' | 'private' | 'intensive'
const currency = (value: number) => formatRupiah(Math.round(value))
const ratio = (value: number, total: number) => total > 0 ? value / total * 100 : 0

export function SalesAnalytics({ report, granularity, onGranularityChange }: {
  report: SalesReport
  granularity: SalesGranularity
  onGranularityChange: (value: SalesGranularity) => void
}) {
  const id = useId()
  const [view, setView] = useState<AnalyticsView>('performance')
  const [focus, setFocus] = useState<ProductFocus>('all')
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % VIEWS.length
      : event.key === 'ArrowLeft' ? (index + VIEWS.length - 1) % VIEWS.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? VIEWS.length - 1 : null
    if (next === null) return
    event.preventDefault()
    setView(VIEWS[next].key)
    document.getElementById(`${id}-tab-${VIEWS[next].key}`)?.focus()
  }
  return <section className={styles.analytics} aria-label="Sales analytics">
    <div className={styles.tabs} role="tablist" aria-label="Sales analytics sections">
      {VIEWS.map((item, index) => <button type="button" key={item.key} role="tab" id={`${id}-tab-${item.key}`} aria-selected={view === item.key} aria-controls={`${id}-panel-${item.key}`} tabIndex={view === item.key ? 0 : -1} onClick={() => setView(item.key)} onKeyDown={event => navigateTabs(event, index)}>{item.label}</button>)}
    </div>
    {VIEWS.map(item => <div key={item.key} className={styles.panel} role="tabpanel" id={`${id}-panel-${item.key}`} aria-labelledby={`${id}-tab-${item.key}`} tabIndex={0} hidden={view !== item.key}>
      {view === item.key ? <>
      {view === 'performance' ? <>
        <SalesPerformanceChart report={report} granularity={granularity} onGranularityChange={onGranularityChange}/>
        <div className={styles.grid}><SalesFinancialComparison report={report}/><SalesOrderVolumeChart report={report}/></div>
        <CustomerSnapshot report={report}/>
      </> : view === 'products' ? <>
        <div className={styles.cardHeader}><div><h3>Products & mentoring</h3><p>Choose a scope to see purchasing trends and top products.</p></div><label className={styles.localControl}>Product focus<select value={focus} onChange={event => setFocus(event.target.value as ProductFocus)}><option value="all">All categories</option><option value="private">Private Mentoring</option><option value="intensive">Intensive Mentoring</option></select></label></div>
        {focus === 'all' ? <>
          <div className={styles.grid}><SalesBreakdownChart title="Revenue by category" description="Net revenue from paid items by business category." rows={report.categories.map(row => ({ ...row, label: CATEGORY_LABELS[row.key] ?? row.label }))}/><SalesBreakdownChart title="Units by category" description="Paid item units, including orders with multiple items." rows={report.categories.map(row => ({ ...row, label: CATEGORY_LABELS[row.key] ?? row.label }))} metric="units"/></div>
          <SalesProductRanking products={report.products}/>
        </> : focus === 'private' ? <PrivateAnalytics report={report}/> : <IntensiveAnalytics report={report}/>}
      </> : <PaymentDiscountAnalytics report={report}/>}
      </> : null}
    </div>)}
  </section>
}

function CustomerSnapshot({ report }: { report: SalesReport }) {
  const id = useId()
  return <article className={styles.card} aria-labelledby={`${id}-title`}>
    <header className={styles.cardHeader}><div><h3 id={`${id}-title`}>New & repeat customers</h3><p>Unique paying customers in this period and scope.</p></div></header>
    <div className={styles.stats}>
      <div className={styles.stat}><span>Unique customers</span><strong>{count(report.totals.buyers)}</strong><small>Each person counts once, regardless of item count.</small></div>
      <div className={styles.stat}><span>First-time customers</span><strong>{count(report.customers.first_time)}</strong><small>One paid order across their history by the end of the period.</small></div>
      <div className={styles.stat}><span>Repeat customers</span><strong>{count(report.customers.repeat)}</strong><small>{percent(report.customers.repeat_share)} of customers in this period.</small></div>
    </div>
    <p className={styles.note}>Repeat customers have at least two paid orders by the end of the period, including purchases in this period. History covers all categories; an order with multiple items counts once.</p>
  </article>
}

function PrivateAnalytics({ report }: { report: SalesReport }) {
  const purchaseRows = report.private_purchase_types
  const sessionRows = [...report.private_sessions].sort((a, b) => (a.sessions ?? Number.MAX_SAFE_INTEGER) - (b.sessions ?? Number.MAX_SAFE_INTEGER) || a.label.localeCompare(b.label, 'id'))
  const known = sessionRows.filter(row => row.sessions != null && row.sessions > 0)
  const purchasedSessions = known.reduce((total, row) => total + row.sessions! * row.units, 0)
  const knownUnits = known.reduce((total, row) => total + row.units, 0)
  const knownRevenue = known.reduce((total, row) => total + row.net, 0)
  return <>
    <div className={styles.grid}>
      <SalesBreakdownChart title="Revenue by mentor tier" description="Mentor tier recorded on historical Private Mentoring purchases." rows={report.private_tiers} color={SALES_COLORS.private}/>
      <SalesBreakdownChart title="Session purchase size" description="Purchase units by actual session count, including flexible offers." rows={report.private_sessions} metric="units" color={SALES_COLORS.private} valueLabel="Purchase units"/>
    </div>
    {knownUnits > 0 ? <div className={styles.stats} data-wide-value={currency(knownRevenue / purchasedSessions).length > 17}>
      <div className={styles.stat}><span>Sessions purchased</span><strong>{count(purchasedSessions)}</strong><small>From items with a known historical session count.</small></div>
      <div className={styles.stat}><span>Average purchase size</span><strong>{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(purchasedSessions / knownUnits)} sessions</strong><small>Session count / purchase units with session metadata.</small></div>
      <div className={styles.stat}><span>Average net price per session</span><strong>{currency(knownRevenue / purchasedSessions)}</strong><small>Revenue from items with session metadata / sessions purchased.</small></div>
    </div> : null}
    <div className={styles.grid}>
      <article className={styles.card}>
        <header className={styles.cardHeader}><div><h3>New purchases & top-ups</h3><p>Purchased sessions from transaction records, independent of current enrollment balances.</p></div></header>
        {purchaseRows.length ? <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.visuallyHidden}>Orders, sessions purchased and revenue from Private Mentoring purchases</caption><thead><tr><th scope="col">Purchase type</th><th scope="col" className={styles.numeric}>Orders</th><th scope="col" className={styles.numeric}>Sessions purchased</th><th scope="col" className={styles.numeric}>Net</th></tr></thead><tbody>{purchaseRows.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td className={styles.numeric}>{count(row.orders)}</td><td className={styles.numeric}>{row.purchased_sessions == null ? 'Unknown' : count(row.purchased_sessions)}</td><td className={styles.numeric}>{currency(row.net)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>No paid Private Mentoring purchases in this period.</p>}
        <p className={styles.note}>Sessions without a confirmed historical source are excluded from the session count. Orders containing new purchases and top-ups may appear in both types.</p>
      </article>
      <article className={styles.card}>
        <header className={styles.cardHeader}><div><h3>Session count breakdown</h3><p>All recorded purchase sizes, including nonstandard session counts.</p></div></header>
        {sessionRows.length ? <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.visuallyHidden}>Private Mentoring purchases by historical session count</caption><thead><tr><th scope="col">Sessions per unit</th><th scope="col" className={styles.numeric}>Unit</th><th scope="col" className={styles.numeric}>Net</th></tr></thead><tbody>{sessionRows.map(row => <tr key={row.key}><th scope="row">{row.sessions === null || row.sessions === undefined ? 'Unknown' : `${count(row.sessions)} sessions`}</th><td className={styles.numeric}>{count(row.units)}</td><td className={styles.numeric}>{currency(row.net)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>No session purchase data in this period.</p>}
      </article>
    </div>
    <SalesProductRanking products={report.products.filter(row => row.category === 'private')}/>
  </>
}

function IntensiveAnalytics({ report }: { report: SalesReport }) {
  return <>
    <div className={styles.grid}>
      <SalesBreakdownChart title="Revenue by Intensive type" description="Packages, bundles, add-ons and International Offers based on paid items." rows={report.intensive_subtypes} color={SALES_COLORS.intensive} tooltipDetails={row => `${count(row.units)} unit · ${percent(ratio(row.net, report.categories.find(category => category.key === 'intensive')?.net ?? 0))} of Intensive revenue`}/>
      <SalesBreakdownChart title="Units by Intensive type" description="Paid item units by Intensive offer type." rows={report.intensive_subtypes} metric="units" color={SALES_COLORS.intensive}/>
    </div>
    <p className={styles.sectionNote}>Sessions per month come from the package purchase snapshot. Competition scope uses available catalog records and may change. Bundles, add-ons and custom offers retain their respective types.</p>
    <SalesProductRanking products={report.products.filter(row => row.category === 'intensive')}/>
  </>
}

function PaymentDiscountAnalytics({ report }: { report: SalesReport }) {
  const lifecycleRows: SalesBreakdown[] = report.statuses.map(row => ({
    key: row.key, label: statusLabel(row.key), orders: row.orders, net: row.amount,
    gross: 0, discount: 0, units: 0, buyers: 0, aov: 0,
  }))
  const codes = [...report.discounts].sort((a, b) => b.net - a.net || a.code.localeCompare(b.code, 'id')).slice(0, 10)
  return <>
    <div className={styles.grid}>
      <SalesBreakdownChart title="Payment method" description="One payment result per paid order; retries do not increase the count." rows={report.payments.map(row => ({ ...row, label: paymentMethodLabel(row.key) }))} metric="orders" color={SALES_COLORS.paid} tooltipDetails={row => `${currency(row.net)} · ${percent(ratio(row.orders, report.totals.orders))} of paid orders`}/>
      <SalesBreakdownChart title="Order lifecycle" description="Current statuses of orders created in this period, by creation date." rows={lifecycleRows} metric="orders" valueLabel="Orders created" tooltipDetails={row => `${currency(row.net)} order amount; excluded from payment-period revenue`}/>
    </div>
    <div className={styles.stats} data-wide-value={[report.totals.discount, report.discount_orders > 0 ? report.totals.discount / report.discount_orders : 0].some(value => currency(value).length > 17)}>
      <div className={styles.stat}><span>Discounts on paid orders</span><strong>{currency(report.totals.discount)}</strong><small>{percent(ratio(report.totals.discount, report.totals.gross))} reduction from gross to net.</small></div>
      <div className={styles.stat}><span>Orders with discounts</span><strong>{count(report.discount_orders)}</strong><small>{percent(ratio(report.discount_orders, report.totals.orders))} of all paid orders in this scope.</small></div>
      <div className={styles.stat}><span>Average discount</span><strong>{currency(report.discount_orders > 0 ? report.totals.discount / report.discount_orders : 0)}</strong><small>Per paid order with a discount.</small></div>
    </div>
    <div className={styles.grid}>
      <SalesFinancialComparison report={report} overTime/>
      <article className={styles.card}>
        <header className={styles.cardHeader}><div><h3>Discount code performance</h3><p>Top 10 codes by net revenue from paid sales.</p></div></header>
        {codes.length ? <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.visuallyHidden}>Historical discount code usage and amounts on paid orders</caption><thead><tr><th scope="col">Code</th><th scope="col" className={styles.numeric}>Orders</th><th scope="col" className={styles.numeric}>Gross</th><th scope="col" className={styles.numeric}>Discount</th><th scope="col" className={styles.numeric}>Net</th><th scope="col" className={styles.numeric}>Average</th></tr></thead><tbody>{codes.map(row => <tr key={row.code}><th scope="row"><span className={styles.productName} title={row.code}>{row.code}</span></th><td className={styles.numeric}>{count(row.orders)}</td><td className={styles.numeric}>{currency(row.gross)}</td><td className={styles.numeric}>{currency(row.discount)}</td><td className={styles.numeric}>{currency(row.net)}</td><td className={styles.numeric}>{currency(row.average_discount)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>No paid orders used a discount code in this period.</p>}
        <p className={styles.note}>Amounts come from order snapshots. Reserved or released discounts do not count as usage.</p>
      </article>
    </div>
  </>
}
