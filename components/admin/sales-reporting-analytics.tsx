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
  { key: 'performance', label: 'Kinerja Penjualan' },
  { key: 'products', label: 'Produk & Mentoring' },
  { key: 'payments', label: 'Pembayaran & Diskon' },
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
  return <section className={styles.analytics} aria-label="Analitik penjualan">
    <div className={styles.tabs} role="tablist" aria-label="Bagian analitik penjualan">
      {VIEWS.map((item, index) => <button type="button" key={item.key} role="tab" id={`${id}-tab-${item.key}`} aria-selected={view === item.key} aria-controls={`${id}-panel-${item.key}`} tabIndex={view === item.key ? 0 : -1} onClick={() => setView(item.key)} onKeyDown={event => navigateTabs(event, index)}>{item.label}</button>)}
    </div>
    {VIEWS.map(item => <div key={item.key} className={styles.panel} role="tabpanel" id={`${id}-panel-${item.key}`} aria-labelledby={`${id}-tab-${item.key}`} tabIndex={0} hidden={view !== item.key}>
      {view === item.key ? <>
      {view === 'performance' ? <>
        <SalesPerformanceChart report={report} granularity={granularity} onGranularityChange={onGranularityChange}/>
        <div className={styles.grid}><SalesFinancialComparison report={report}/><SalesOrderVolumeChart report={report}/></div>
        <CustomerSnapshot report={report}/>
      </> : view === 'products' ? <>
        <div className={styles.cardHeader}><div><h3>Produk & mentoring</h3><p>Pilih cakupan analisis untuk melihat perilaku pembelian dan produk teratas.</p></div><label className={styles.localControl}>Fokus produk<select value={focus} onChange={event => setFocus(event.target.value as ProductFocus)}><option value="all">Semua kategori</option><option value="private">Private Mentoring</option><option value="intensive">Intensive Mentoring</option></select></label></div>
        {focus === 'all' ? <>
          <div className={styles.grid}><SalesBreakdownChart title="Pendapatan per kategori" description="Pendapatan bersih item lunas menurut kategori bisnis." rows={report.categories.map(row => ({ ...row, label: CATEGORY_LABELS[row.key] ?? row.label }))}/><SalesBreakdownChart title="Unit per kategori" description="Jumlah unit item lunas, termasuk pesanan dengan beberapa item." rows={report.categories.map(row => ({ ...row, label: CATEGORY_LABELS[row.key] ?? row.label }))} metric="units"/></div>
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
    <header className={styles.cardHeader}><div><h3 id={`${id}-title`}>Pembeli baru & berulang</h3><p>Pembeli unik yang membayar pada periode dan cakupan ini.</p></div></header>
    <div className={styles.stats}>
      <div className={styles.stat}><span>Pembeli unik</span><strong>{count(report.totals.buyers)}</strong><small>Satu orang tetap satu pembeli, berapa pun jumlah itemnya.</small></div>
      <div className={styles.stat}><span>Pembeli pertama kali</span><strong>{count(report.customers.first_time)}</strong><small>Memiliki satu pesanan lunas sepanjang riwayat hingga akhir periode.</small></div>
      <div className={styles.stat}><span>Pembeli berulang</span><strong>{count(report.customers.repeat)}</strong><small>{percent(report.customers.repeat_share)} dari pembeli periode ini.</small></div>
    </div>
    <p className={styles.note}>Pembeli berulang memiliki minimal dua pesanan lunas sepanjang riwayat sebelum akhir periode, termasuk pembelian pada periode ini. Riwayat memakai semua kategori; satu pesanan dengan beberapa item tetap dihitung satu kali.</p>
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
      <SalesBreakdownChart title="Pendapatan per tier mentor" description="Tier pada sumber pembelian historis Private Mentoring." rows={report.private_tiers} color={SALES_COLORS.private}/>
      <SalesBreakdownChart title="Ukuran pembelian sesi" description="Unit pembelian menurut jumlah sesi aktual; mencakup penawaran fleksibel." rows={report.private_sessions} metric="units" color={SALES_COLORS.private} valueLabel="Unit pembelian"/>
    </div>
    {knownUnits > 0 ? <div className={styles.stats} data-wide-value={currency(knownRevenue / purchasedSessions).length > 17}>
      <div className={styles.stat}><span>Sesi dibeli</span><strong>{count(purchasedSessions)}</strong><small>Dari item dengan jumlah sesi historis yang diketahui.</small></div>
      <div className={styles.stat}><span>Rata-rata ukuran pembelian</span><strong>{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(purchasedSessions / knownUnits)} sesi</strong><small>Jumlah sesi / unit pembelian dengan metadata sesi.</small></div>
      <div className={styles.stat}><span>Rata-rata harga bersih per sesi</span><strong>{currency(knownRevenue / purchasedSessions)}</strong><small>Pendapatan item dengan metadata sesi / sesi dibeli.</small></div>
    </div> : null}
    <div className={styles.grid}>
      <article className={styles.card}>
        <header className={styles.cardHeader}><div><h3>Pembelian baru & top-up</h3><p>Sesi yang dibeli dari sumber transaksi, bukan saldo enrollment saat ini.</p></div></header>
        {purchaseRows.length ? <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.visuallyHidden}>Pesanan, sesi diperoleh, dan pendapatan pembelian Private Mentoring</caption><thead><tr><th scope="col">Jenis pembelian</th><th scope="col" className={styles.numeric}>Pesanan</th><th scope="col" className={styles.numeric}>Sesi dibeli</th><th scope="col" className={styles.numeric}>Bersih</th></tr></thead><tbody>{purchaseRows.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td className={styles.numeric}>{count(row.orders)}</td><td className={styles.numeric}>{row.purchased_sessions == null ? 'Tidak diketahui' : count(row.purchased_sessions)}</td><td className={styles.numeric}>{currency(row.net)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>Belum ada pembelian Private Mentoring lunas pada periode ini.</p>}
        <p className={styles.note}>Sesi tanpa sumber historis yang dapat dipastikan tidak dimasukkan ke jumlah sesi. Pesanan dengan pembelian baru dan top-up dapat muncul di kedua jenis.</p>
      </article>
      <article className={styles.card}>
        <header className={styles.cardHeader}><div><h3>Rincian jumlah sesi</h3><p>Semua ukuran pembelian yang tercatat, termasuk jumlah sesi nonstandar.</p></div></header>
        {sessionRows.length ? <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.visuallyHidden}>Pembelian Private Mentoring berdasarkan jumlah sesi historis</caption><thead><tr><th scope="col">Sesi per unit</th><th scope="col" className={styles.numeric}>Unit</th><th scope="col" className={styles.numeric}>Bersih</th></tr></thead><tbody>{sessionRows.map(row => <tr key={row.key}><th scope="row">{row.sessions === null || row.sessions === undefined ? 'Tidak diketahui' : `${count(row.sessions)} sesi`}</th><td className={styles.numeric}>{count(row.units)}</td><td className={styles.numeric}>{currency(row.net)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>Belum ada data pembelian sesi pada periode ini.</p>}
      </article>
    </div>
    <SalesProductRanking products={report.products.filter(row => row.category === 'private')}/>
  </>
}

function IntensiveAnalytics({ report }: { report: SalesReport }) {
  return <>
    <div className={styles.grid}>
      <SalesBreakdownChart title="Pendapatan per jenis Intensive" description="Paket, bundle, add-on, dan penawaran Internasional berdasarkan item lunas." rows={report.intensive_subtypes} color={SALES_COLORS.intensive} tooltipDetails={row => `${count(row.units)} unit · ${percent(ratio(row.net, report.categories.find(category => category.key === 'intensive')?.net ?? 0))} dari pendapatan Intensive`}/>
      <SalesBreakdownChart title="Unit per jenis Intensive" description="Unit item lunas menurut jenis penawaran Intensive." rows={report.intensive_subtypes} metric="units" color={SALES_COLORS.intensive}/>
    </div>
    <p className={styles.sectionNote}>Sesi per bulan berasal dari snapshot pembelian paket. Cakupan kompetisi memakai sumber katalog yang masih tersedia; metadata ini dapat berubah. Bundle, add-on, dan penawaran khusus mengikuti jenisnya masing-masing.</p>
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
      <SalesBreakdownChart title="Metode pembayaran" description="Satu hasil pembayaran per pesanan lunas; percobaan ulang tidak menambah hitungan." rows={report.payments.map(row => ({ ...row, label: paymentMethodLabel(row.key) }))} metric="orders" color={SALES_COLORS.paid} tooltipDetails={row => `${currency(row.net)} · ${percent(ratio(row.orders, report.totals.orders))} dari pesanan lunas`}/>
      <SalesBreakdownChart title="Siklus pesanan" description="Status saat ini dari pesanan yang dibuat pada periode ini, berdasarkan waktu pembuatan." rows={lifecycleRows} metric="orders" valueLabel="Pesanan dibuat" tooltipDetails={row => `${currency(row.net)} nominal pesanan; bukan pendapatan periode pembayaran`}/>
    </div>
    <div className={styles.stats} data-wide-value={[report.totals.discount, report.discount_orders > 0 ? report.totals.discount / report.discount_orders : 0].some(value => currency(value).length > 17)}>
      <div className={styles.stat}><span>Diskon pada pesanan lunas</span><strong>{currency(report.totals.discount)}</strong><small>{percent(ratio(report.totals.discount, report.totals.gross))} pengurangan bruto menjadi bersih.</small></div>
      <div className={styles.stat}><span>Pesanan menggunakan diskon</span><strong>{count(report.discount_orders)}</strong><small>{percent(ratio(report.discount_orders, report.totals.orders))} dari semua pesanan lunas pada cakupan ini.</small></div>
      <div className={styles.stat}><span>Rata-rata diskon</span><strong>{currency(report.discount_orders > 0 ? report.totals.discount / report.discount_orders : 0)}</strong><small>Per pesanan lunas yang menggunakan diskon.</small></div>
    </div>
    <div className={styles.grid}>
      <SalesFinancialComparison report={report} overTime/>
      <article className={styles.card}>
        <header className={styles.cardHeader}><div><h3>Kinerja kode diskon</h3><p>10 kode dengan pendapatan bersih tertinggi dari penjualan lunas.</p></div></header>
        {codes.length ? <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.visuallyHidden}>Pemakaian dan nilai historis kode diskon pada pesanan lunas</caption><thead><tr><th scope="col">Kode</th><th scope="col" className={styles.numeric}>Pesanan</th><th scope="col" className={styles.numeric}>Bruto</th><th scope="col" className={styles.numeric}>Diskon</th><th scope="col" className={styles.numeric}>Bersih</th><th scope="col" className={styles.numeric}>Rata-rata</th></tr></thead><tbody>{codes.map(row => <tr key={row.code}><th scope="row"><span className={styles.productName} title={row.code}>{row.code}</span></th><td className={styles.numeric}>{count(row.orders)}</td><td className={styles.numeric}>{currency(row.gross)}</td><td className={styles.numeric}>{currency(row.discount)}</td><td className={styles.numeric}>{currency(row.net)}</td><td className={styles.numeric}>{currency(row.average_discount)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>Tidak ada pesanan lunas menggunakan kode diskon pada periode ini.</p>}
        <p className={styles.note}>Nilai berasal dari snapshot pesanan. Reservasi atau diskon yang dilepas tidak dihitung sebagai pemakaian.</p>
      </article>
    </div>
  </>
}
