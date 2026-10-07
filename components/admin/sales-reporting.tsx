'use client'

import { Printer, RefreshCw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/commerce/money'
import {
  comparisonText, count, displayDate, jakartaDate, shiftDate,
  type SalesGranularity, type SalesReport, type SalesScope, type SalesView,
} from '@/lib/admin/sales-reporting'
import { SalesAnalytics } from './sales-reporting-analytics'
import { SalesMix, SalesPerformanceChart, SalesProductRanking, SalesStatusSnapshot, useSalesChartPrinting } from './sales-reporting-charts'
import { SalesTransactions } from './sales-reporting-transactions'
import styles from './sales-reporting.module.css'

const VIEWS: Array<[SalesView, string]> = [['summary', 'Ringkasan'], ['analytics', 'Analitik'], ['transactions', 'Transaksi & Ekspor']]
const PRESETS = [['7', '7 hari'], ['30', '30 hari'], ['90', '90 hari'], ['year', 'Tahun ini'], ['all', 'Semua waktu'], ['custom', 'Kustom']]
const SCOPES: Array<[SalesScope, string]> = [['all', 'Semua penjualan'], ['digital', 'Produk Digital'], ['private', 'Private Mentoring'], ['intensive', 'Intensive Mentoring']]
const isDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00+07:00`)) && jakartaDate(new Date(`${value}T00:00:00+07:00`)) === value)

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
  const compare = params.get('reportCompare') !== '0'
  const from = preset === 'all' ? null : preset === 'year' ? `${today.slice(0, 4)}-01-01` : preset === 'custom' ? (isDate(params.get('reportFrom')) ? params.get('reportFrom')! : shiftDate(today, -29)) : shiftDate(today, -(Number(preset) - 1))
  const to = preset === 'custom' && isDate(params.get('reportTo')) ? params.get('reportTo')! : today
  const validRange = !from || from <= to
  const filterKey = JSON.stringify([from, to, scope, compare])
  const [storedReport, setReport] = useState<SalesReport | null>(null)
  const [loadedFor, setLoadedFor] = useState('')
  const report = loadedFor === filterKey ? storedReport : null
  const [granularity, setGranularity] = useState<SalesGranularity>('auto')
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const invalidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const printedAt = useRef<HTMLSpanElement>(null)

  function updateParams(values: Record<string, string>, push = false) {
    const next = new URLSearchParams(params.toString())
    next.set('reportView', view)
    Object.entries(values).forEach(([key, value]) => next.set(key, value))
    router[push ? 'push' : 'replace'](`${pathname}?${next.toString()}`, { scroll: false })
  }

  useEffect(() => {
    if (!validRange) { setLoading(false); return }
    let current = true
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        const result = await client.rpc('get_admin_sales_report', { p_from: from ?? undefined, p_to: to, p_scope: scope, p_compare: compare, p_granularity: granularity })
        if (!current) return
        if (result.error || !result.data) setError('Laporan belum dapat dimuat. Silakan coba lagi.')
        else { setReport(result.data as unknown as SalesReport); setLoadedFor(filterKey) }
      } catch {
        if (current) setError('Laporan belum dapat dimuat. Periksa koneksi lalu coba lagi.')
      } finally { if (current) setLoading(false) }
    }, 250)
    return () => { current = false; clearTimeout(timer) }
  }, [client, from, to, scope, compare, granularity, revision, validRange, filterKey])

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
  function printReport() {
    if (printedAt.current) printedAt.current.textContent = displayDate(new Date().toISOString(), true)
    document.body.dataset.salesReportPrint = 'true'
    window.print()
  }

  const rangeLabel = `${from ? displayDate(from) : 'Sejak awal'} – ${displayDate(to)}`
  const scopeLabel = SCOPES.find(([key]) => key === scope)![1]
  return <div className={styles.workspace} data-sales-report>
    <header className={styles.pageHeader}>
      <div><p className={styles.eyebrow}>Bisnis · Shared Commerce</p><h2>Laporan Penjualan</h2><p>Pendapatan, perilaku pembelian, dan transaksi dalam satu ruang laporan.</p></div>
      {view !== 'transactions' ? <button type="button" className={styles.button} onClick={printReport} disabled={loading || !report || !validRange || Boolean(error)}><Printer size={15} aria-hidden="true" />Cetak laporan</button> : null}
    </header>
    <div className={styles.printMetadata}><strong>{rangeLabel} · {scopeLabel}</strong><span>Dicetak: <span ref={printedAt} /> WIB</span>{view === 'transactions' ? <span>Hanya halaman transaksi yang sedang ditampilkan. Gunakan ekspor untuk seluruh data.</span> : null}</div>
    <nav className={styles.tabs} role="tablist" aria-label="Tampilan laporan">
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
      <label className={styles.field}><span>Periode</span><select value={preset} onChange={event => updateParams({ reportRange: event.target.value, ...(event.target.value === 'custom' ? { reportFrom: from ?? shiftDate(today, -29), reportTo: to } : {}) })}>{PRESETS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {preset === 'custom' ? <><label className={styles.field}><span>Dari</span><input type="date" value={from ?? ''} max={to} onChange={event => updateParams({ reportFrom: event.target.value })} /></label><label className={styles.field}><span>Sampai</span><input type="date" value={to} min={from ?? undefined} onChange={event => updateParams({ reportTo: event.target.value })} /></label></> : null}
      <label className={styles.field}><span>Lingkup bisnis</span><select value={scope} onChange={event => updateParams({ reportScope: event.target.value })}>{SCOPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={styles.checkbox}><input type="checkbox" checked={compare && preset !== 'all'} disabled={preset === 'all'} onChange={event => updateParams({ reportCompare: event.target.checked ? '1' : '0' })} /><span>Bandingkan periode sebelumnya</span></label>
      <button type="button" className={styles.iconButton} aria-label="Muat ulang laporan" title="Muat ulang laporan" disabled={loading || !validRange} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true" /></button>
    </div>
    <div className={styles.methodology}><span>{rangeLabel} · WIB{report ? ` · Interval ${report.range.granularity === 'day' ? 'harian' : report.range.granularity === 'week' ? 'mingguan' : 'bulanan'}` : ''}</span><details><summary>Dasar perhitungan</summary><p>Penjualan hanya mencakup order lunas berdasarkan waktu pembayaran. Status order dihitung berdasarkan waktu dibuat. {scope !== 'all' ? 'KPI dan analitik menjumlahkan item sesuai lingkup; tabel transaksi menampilkan nilai order lengkap.' : 'Pendapatan bersih = subtotal − diskon.'} Subtotal historis yang kosong memakai nilai bersih + diskon. Pembeli berulang memiliki lebih dari satu order lunas sampai akhir periode. {report?.legacy_paid_orders ? `${count(report.legacy_paid_orders)} order historis menggunakan waktu upaya pembayaran lunas, lalu waktu pembaruan order jika waktu bayar tidak tersedia.` : ''} Semua waktu memakai Asia/Jakarta.</p></details></div>
    {!validRange ? <p className={styles.error} role="alert">Tanggal awal harus sebelum atau sama dengan tanggal akhir.</p> : null}
    {error ? <div className={styles.error} role="alert">{error}<button type="button" className={styles.button} onClick={() => setRevision(value => value + 1)}>Coba lagi</button></div> : null}
    {loading ? <p className={styles.loading} role="status">{report ? 'Menyegarkan laporan…' : 'Memuat laporan penjualan…'}</p> : null}
    {VIEWS.map(([panel]) => <section key={panel} id={`report-panel-${panel}`} role="tabpanel" aria-labelledby={`report-tab-${panel}`} aria-busy={loading} tabIndex={0} className={styles.panel} hidden={view !== panel}>
      {view === panel ? <>
      {view === 'transactions' ? <SalesTransactions from={from} to={to} scope={scope} compare={compare} revision={revision} validRange={validRange} rangeLabel={rangeLabel} report={report} onPrint={printReport} /> : report ? view === 'analytics' ? <SalesAnalytics report={report} granularity={granularity} onGranularityChange={setGranularity} /> : <>
        <SalesKpis report={report} />
        {!report.totals.orders ? <p className={styles.empty}>Belum ada order lunas pada periode ini.</p> : null}
        <div className={styles.summaryMain}><SalesPerformanceChart report={report} granularity={granularity} onGranularityChange={setGranularity} /><SalesMix report={report} /></div>
        <div className={styles.summaryBottom}><SalesProductRanking products={report.products} compact /><SalesStatusSnapshot report={report} /></div>
      </> : !loading && !error ? <p className={styles.empty}>Belum ada transaksi pada periode ini.</p> : null}
      </> : null}
    </section>)}
  </div>
}

function SalesKpis({ report }: { report: SalesReport }) {
  const cards = [
    { key: 'net' as const, label: 'Pendapatan bersih', note: 'Nilai lunas setelah diskon', money: true },
    { key: 'gross' as const, label: 'Penjualan bruto', note: 'Subtotal sebelum diskon', money: true },
    { key: 'discount' as const, label: 'Diskon', note: 'Potongan pada order lunas', money: true },
    { key: 'orders' as const, label: 'Order lunas', note: `${count(report.totals.units)} item terjual`, money: false },
    { key: 'aov' as const, label: 'Rata-rata nilai order', note: 'Pendapatan bersih / order lunas', money: true },
    { key: 'buyers' as const, label: 'Pembeli unik', note: `${count(report.customers.repeat)} pembeli berulang`, money: false },
  ]
  return <div className={styles.kpis}>{cards.map(card => {
    const value = report.totals[card.key], previous = report.previous?.[card.key]
    const tone = card.key === 'discount' || previous === undefined || value === previous ? '' : value > previous ? styles.increase : styles.decrease
    return <article key={card.key} className={styles.kpi}><span>{card.label}</span><strong>{card.money ? formatRupiah(Math.round(value)) : count(value)}</strong><small>{card.note}</small>{previous !== undefined ? <small className={tone}>{comparisonText(value, previous)}</small> : null}</article>
  })}</div>
}
