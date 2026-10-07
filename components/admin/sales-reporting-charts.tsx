'use client'

import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale,
  LineElement, PointElement, Tooltip, type ChartOptions,
} from 'chart.js'
import { useEffect, useId, useMemo, useState } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'

import {
  CATEGORY_LABELS, SALES_COLORS, comparisonLabel, count, displayDate, itemKindLabel, metricValue,
  percent, statusLabel, type ProductPerformance, type SalesBreakdown,
  type SalesGranularity, type SalesMetric, type SalesReport,
} from '@/lib/admin/sales-reporting'
import { formatRupiah } from '@/lib/commerce/money'
import styles from './sales-reporting-charts.module.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend)
const chartFont = typeof document === 'undefined' ? "'Poppins', sans-serif" : getComputedStyle(document.body).fontFamily
ChartJS.defaults.font.family = chartFont

export function useSalesChartPrinting() {
  useEffect(() => {
    const resize = () => {
      for (const chart of Object.values(ChartJS.instances)) {
        if (chart.canvas.closest('[data-sales-report]') && chart.canvas.offsetParent !== null) {
          chart.resize(); chart.update('none')
        }
      }
    }
    window.addEventListener('beforeprint', resize)
    window.addEventListener('afterprint', resize)
    return () => { window.removeEventListener('beforeprint', resize); window.removeEventListener('afterprint', resize) }
  }, [])
}

const METRIC_LABELS: Record<SalesMetric, string> = {
  net: 'Pendapatan bersih', gross: 'Penjualan bruto', discount: 'Diskon',
  orders: 'Pesanan lunas', units: 'Unit terjual',
}
const SERIES = ['total', 'digital', 'private', 'intensive', 'other'] as const
const gridColor = 'rgba(100, 113, 128, .10)'
const compactNumber = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })
const shortLabel = (value: string, length = 26) => value.length > length ? `${value.slice(0, length - 1)}…` : value
const axisValue = (metric: SalesMetric, value: string | number) => `${metric === 'units' || metric === 'orders' ? '' : 'Rp'}${compactNumber.format(Number(value))}`
const currency = (value: number) => formatRupiah(Math.round(value))

function EmptyChart({ message = 'Belum ada penjualan lunas pada periode dan cakupan ini.' }: { message?: string }) {
  return <div className={styles.empty} role="status">{message}</div>
}

export function SalesPerformanceChart({ report, granularity, onGranularityChange }: {
  report: SalesReport
  granularity: SalesGranularity
  onGranularityChange: (value: SalesGranularity) => void
}) {
  const id = useId()
  const [metric, setMetric] = useState<SalesMetric>('net')
  const [series, setSeries] = useState<string[]>(['total', 'digital', 'private', 'intensive'])
  // Only the backend's equal-duration previous-period buckets are aligned.
  // Custom comparison totals use their own dates without a synthetic overlay.
  const compare = report.range.comparison_aligned && report.previous !== null && report.previous_trend.length === report.trend.length && report.trend.length > 0
  const length = report.trend.length
  const labels = report.trend.map(point => point.date)
  const hasSales = report.totals.orders > 0 || Boolean(compare && report.previous?.orders)
  const data = {
    labels,
    datasets: [
      ...series.map(key => ({
        label: CATEGORY_LABELS[key],
        data: labels.map((_, index) => {
          const point = report.trend[index]
          return point ? key === 'total' ? point.total[metric] : point.categories[key]?.[metric] ?? 0 : null
        }),
        borderColor: SALES_COLORS[key], backgroundColor: SALES_COLORS[key],
        borderWidth: key === 'total' ? 2.5 : 2, pointRadius: length === 1 ? 4 : 0,
        pointHoverRadius: 4, pointHitRadius: 12, tension: .2,
      })),
      ...(compare ? [{
        label: 'Total · periode sebelumnya',
        data: labels.map((_, index) => report.previous_trend[index]?.total[metric] ?? null),
        borderColor: '#c6a78e', backgroundColor: '#c6a78e', borderWidth: 2,
        borderDash: [6, 4], pointRadius: length === 1 ? 4 : 0, pointHoverRadius: 4,
        pointHitRadius: 12, tension: .2,
      }] : []),
    ],
  }
  const options: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid: { display: false }, border: { display: false },
        ticks: {
          color: '#73808c', maxRotation: 0, autoSkip: true, maxTicksLimit: 8,
          font: { size: 10 },
          callback: (_value, index) => {
            const date = report.trend[index]?.date
            if (!date) return `${index + 1}`
            return new Intl.DateTimeFormat('id-ID', {
              timeZone: 'UTC', month: 'short',
              ...(report.range.granularity === 'month' ? { year: '2-digit' as const } : { day: 'numeric' as const }),
            }).format(new Date(`${date}T00:00:00Z`))
          },
        },
      },
      y: {
        beginAtZero: true, border: { display: false }, grid: { color: gridColor },
        ticks: { color: '#73808c', font: { size: 10 }, maxTicksLimit: 6, precision: 0, callback: value => axisValue(metric, value) },
      },
    },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'line', padding: 14, boxWidth: 16, font: { size: 10 }, color: '#596673' } },
      tooltip: {
        backgroundColor: '#24313e', padding: 11, cornerRadius: 8,
        titleFont: { family: chartFont, size: 11 }, bodyFont: { family: chartFont, size: 11 },
        callbacks: {
          title: items => {
            const date = report.trend[items[0]?.dataIndex ?? 0]?.date
            return date ? displayDate(date) : 'Periode laporan'
          },
          label: context => {
            const value = context.parsed.y ?? 0
            const key = series[context.datasetIndex]
            const total = report.trend[context.dataIndex]?.total[metric] ?? 0
            const share = key && key !== 'total' && metric !== 'orders' && total > 0 ? ` · ${percent(value / total * 100)}` : ''
            return `${context.dataset.label}: ${metricValue(metric, value)}${share}`
          },
          afterLabel: context => compare && context.datasetIndex === series.length ? `Pembanding: ${displayDate(report.previous_trend[context.dataIndex]?.date ?? null)}` : '',
        },
      },
    },
  }
  function toggleSeries(key: string) {
    setSeries(current => current.includes(key)
      ? current.length > 1 ? current.filter(value => value !== key) : current
      : current.length + (compare ? 1 : 0) < 6 ? [...current, key] : current)
  }
  return <article className={styles.card} aria-labelledby={`${id}-title`}>
    <header className={styles.cardHeader}>
      <div><h3 id={`${id}-title`}>Kinerja penjualan</h3><p>Penjualan lunas berdasarkan waktu pembayaran di Asia/Jakarta.</p></div>
      <div className={styles.controls}>
        <label>Metrik<select value={metric} onChange={event => setMetric(event.target.value as SalesMetric)}>{Object.entries(METRIC_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Interval<select value={granularity} onChange={event => onGranularityChange(event.target.value as SalesGranularity)}><option value="auto">Otomatis</option><option value="day">Harian</option><option value="week">Mingguan</option><option value="month">Bulanan</option></select></label>
      </div>
    </header>
    <div className={styles.seriesPicker} role="group" aria-label="Seri yang ditampilkan">
      {SERIES.map(key => <button type="button" key={key} aria-pressed={series.includes(key)} onClick={() => toggleSeries(key)} disabled={!series.includes(key) && series.length + (compare ? 1 : 0) >= 6}><span className={styles.swatch} style={{ backgroundColor: SALES_COLORS[key] }} aria-hidden="true"/>{CATEGORY_LABELS[key]}</button>)}
    </div>
    {hasSales && length > 0 ? <div className={styles.mainCanvas}><Line data={data} options={options} role="img" aria-label={`${METRIC_LABELS[metric]} dari waktu ke waktu`} aria-describedby={`${id}-summary`}/></div> : <EmptyChart/>}
    <p id={`${id}-summary`} className={styles.note}>{METRIC_LABELS[metric]} periode ini: <strong>{metricValue(metric, report.totals[metric])}</strong>{report.previous ? <>; {comparisonLabel(report.range)}: <strong>{metricValue(metric, report.previous[metric])}</strong>.</> : '.'} {compare ? 'Garis putus-putus membandingkan total pada urutan interval yang sama; tooltip mencantumkan tanggal pembanding.' : report.previous ? 'Grafik menampilkan periode utama; total pembanding dihitung dari rentangnya sendiri.' : ''} Klik legenda untuk sembunyikan seri. Maksimal 6 seri.</p>
  </article>
}

export function SalesMix({ report }: { report: SalesReport }) {
  const id = useId()
  const rows = report.categories.filter(row => row.units > 0 || row.net > 0)
  const options: ChartOptions<'doughnut'> = {
    responsive: true, maintainAspectRatio: false, animation: false, cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: context => {
        const row = rows[context.dataIndex]
        return `${currency(row.net)} · ${percent(report.totals.net > 0 ? row.net / report.totals.net * 100 : 0)} dari pendapatan bersih`
      }, afterLabel: context => `${count(rows[context.dataIndex].units)} unit terjual` } },
    },
  }
  return <article className={styles.card} aria-labelledby={`${id}-title`}>
    <header className={styles.cardHeader}><div><h3 id={`${id}-title`}>Komposisi penjualan</h3><p>Kontribusi kategori pada penjualan lunas.</p></div></header>
    {rows.length > 0 ? <>
      {report.totals.net > 0 ? <><div className={styles.mixCanvas}><Doughnut data={{ labels: rows.map(row => CATEGORY_LABELS[row.key] ?? row.label), datasets: [{ data: rows.map(row => row.net), backgroundColor: rows.map(row => SALES_COLORS[row.key] ?? SALES_COLORS.other), borderWidth: 3, borderColor: '#fff', hoverOffset: 3 }] }} options={options} role="img" aria-label="Kontribusi pendapatan bersih menurut kategori" aria-describedby={`${id}-summary`}/><div className={styles.mixCenter} aria-hidden="true"><span>Kategori penjualan</span><strong>{count(rows.length)}</strong></div></div><p className={styles.note}>Pendapatan bersih: <strong>{currency(report.totals.net)}</strong></p></> : <p className={styles.note}>Semua penjualan lunas memiliki pendapatan bersih nol.</p>}
      <ul id={`${id}-summary`} className={styles.mixList}>{rows.map(row => <li key={row.key}><span><i className={styles.swatch} style={{ backgroundColor: SALES_COLORS[row.key] ?? SALES_COLORS.other }} aria-hidden="true"/>{CATEGORY_LABELS[row.key] ?? row.label}</span><div><strong>{currency(row.net)}</strong><small>{percent(report.totals.net > 0 ? row.net / report.totals.net * 100 : 0)} · {count(row.units)} unit</small></div></li>)}</ul>
    </> : <EmptyChart/>}
  </article>
}

export function SalesBreakdownChart({ title, description, rows, metric = 'net', color, limit = 10, valueLabel, tooltipDetails }: {
  title: string
  description: string
  rows: SalesBreakdown[]
  metric?: SalesMetric
  color?: string
  limit?: number
  valueLabel?: string
  tooltipDetails?: (row: SalesBreakdown) => string
}) {
  const id = useId()
  const ranked = useMemo(() => [...rows].sort((a, b) => b[metric] - a[metric] || a.label.localeCompare(b.label, 'id')).slice(0, limit), [rows, metric, limit])
  const options: ChartOptions<'bar'> = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
    scales: {
      x: { beginAtZero: true, grid: { color: gridColor }, border: { display: false }, ticks: { font: { size: 10 }, precision: 0, maxTicksLimit: 5, callback: value => axisValue(metric, value) } },
      y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 }, autoSkip: false, callback: (_value, index) => shortLabel(ranked[index]?.label ?? '', 25) } },
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: {
        title: items => ranked[items[0]?.dataIndex ?? 0]?.label ?? title,
        label: context => `${valueLabel ?? METRIC_LABELS[metric]}: ${metricValue(metric, context.parsed.x ?? 0)}`,
        afterLabel: context => tooltipDetails ? tooltipDetails(ranked[context.dataIndex]) : metric === 'units' ? `${currency(ranked[context.dataIndex].net)} pendapatan bersih` : `${count(ranked[context.dataIndex].units)} unit · ${count(ranked[context.dataIndex].orders)} pesanan`,
      } },
    },
  }
  return <article className={styles.card} aria-labelledby={`${id}-title`}>
    <header className={styles.cardHeader}><div><h3 id={`${id}-title`}>{title}</h3><p>{description}</p></div></header>
    {ranked.some(row => row.units > 0 || row.orders > 0) ? <><div className={styles.smallCanvas}><Bar data={{ labels: ranked.map(row => row.label), datasets: [{ label: valueLabel ?? METRIC_LABELS[metric], data: ranked.map(row => row[metric]), backgroundColor: ranked.map(row => color ?? SALES_COLORS[row.key] ?? SALES_COLORS.other), borderRadius: 4, borderSkipped: false, maxBarThickness: 22 }] }} options={options} role="img" aria-label={title} aria-describedby={`${id}-summary`}/></div><p id={`${id}-summary`} className={styles.visuallyHidden}>{ranked.map(row => `${row.label}: ${metricValue(metric, row[metric])}${tooltipDetails ? `, ${tooltipDetails(row)}` : ''}`).join('; ')}.</p>{rows.length > limit ? <p className={styles.note}>Menampilkan {count(limit)} kategori tertinggi dari {count(rows.length)} kategori.</p> : null}</> : <EmptyChart/>}
  </article>
}

export function SalesProductRanking({ products, compact = false }: { products: ProductPerformance[]; compact?: boolean }) {
  const id = useId()
  const [metric, setMetric] = useState<'net' | 'units'>('net')
  const limit = compact ? 5 : 10
  const rows = useMemo(() => [...products].sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name, 'id') || a.key.localeCompare(b.key)).slice(0, limit), [products, metric, limit])
  const options: ChartOptions<'bar'> = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
    scales: {
      x: { beginAtZero: true, grid: { color: gridColor }, border: { display: false }, ticks: { maxTicksLimit: 5, precision: 0, font: { size: 10 }, callback: value => axisValue(metric, value) } },
      y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 }, autoSkip: false, callback: (_value, index) => shortLabel(rows[index]?.name ?? '') } },
    },
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      title: items => rows[items[0]?.dataIndex ?? 0]?.name ?? '',
      label: context => `${count(rows[context.dataIndex].units)} unit terjual`,
      afterLabel: context => `${currency(rows[context.dataIndex].net)} pendapatan bersih`,
    } } },
  }
  return <article className={styles.card} aria-labelledby={`${id}-title`}>
    <header className={styles.cardHeader}><div><h3 id={`${id}-title`}>Produk terlaris</h3><p>{compact ? '5' : '10'} produk teratas dari penjualan lunas.</p></div><label className={styles.localControl}>Urutkan<select value={metric} onChange={event => setMetric(event.target.value as 'net' | 'units')}><option value="net">Pendapatan bersih</option><option value="units">Unit terjual</option></select></label></header>
    {rows.length ? <>
      {!compact ? <div className={styles.rankingCanvas}><Bar options={options} data={{ labels: rows.map(row => row.name), datasets: [{ label: METRIC_LABELS[metric], data: rows.map(row => row[metric]), backgroundColor: rows.map(row => SALES_COLORS[row.category] ?? SALES_COLORS.other), borderRadius: 4, borderSkipped: false, maxBarThickness: 22 }] }} role="img" aria-label={`Produk terlaris menurut ${METRIC_LABELS[metric].toLowerCase()}`} aria-describedby={`${id}-table`}/></div> : null}
      <div className={styles.tableScroll}><table className={styles.table} id={`${id}-table`}><caption className={styles.visuallyHidden}>Peringkat produk berdasarkan {METRIC_LABELS[metric].toLowerCase()}</caption><thead><tr><th scope="col">#</th><th scope="col">Produk</th><th scope="col" className={styles.numeric}>Unit</th><th scope="col" className={styles.numeric}>Pendapatan bersih</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.key}><td className={styles.rank}>{index + 1}</td><td><strong className={styles.productName} title={row.name}>{row.name}</strong><small className={styles.productMeta}>{itemKindLabel(row.kind)}{!compact ? <ProductMetadata product={row}/> : null}</small></td><td className={styles.numeric}>{count(row.units)}</td><td className={styles.numeric}>{currency(row.net)}</td></tr>)}</tbody></table></div>
    </> : <EmptyChart/>}
  </article>
}

function ProductMetadata({ product }: { product: ProductPerformance }) {
  const parts: string[] = []
  if (product.kind === 'private_mentoring') {
    if (product.tier) parts.push(product.tier.replace(/_/g, ' '))
    parts.push(product.sessions === null ? 'Sesi tidak diketahui' : `${count(product.sessions)} sesi`)
    if (product.purchase_type) parts.push(product.purchase_type === 'topup' || product.purchase_type === 'top_up' ? 'Top-up' : product.purchase_type === 'new' || product.purchase_type === 'new_enrollment' ? 'Pembelian baru' : 'Jenis pembelian lain')
  }
  if (product.kind === 'intensive_mentoring_package') {
    if (product.competition_scope) parts.push(product.competition_scope === 'national' ? 'Nasional' : product.competition_scope === 'international' ? 'Internasional' : product.competition_scope.replace(/_/g, ' '))
    if (product.sessions_per_month !== null) parts.push(`${count(product.sessions_per_month)} sesi/bulan`)
  }
  return parts.length ? <span> · {parts.join(' · ')}</span> : null
}

export function SalesStatusSnapshot({ report }: { report: SalesReport }) {
  const id = useId()
  const rows = report.statuses.filter(row => row.key !== 'paid')
  return <article className={styles.card} aria-labelledby={`${id}-title`}>
    <header className={styles.cardHeader}><div><h3 id={`${id}-title`}>Status pembayaran</h3><p>Pesanan dibuat pada periode ini; nominal belum menjadi pendapatan.</p></div></header>
    {rows.some(row => row.orders > 0) ? <ul className={styles.statusList}>{rows.map(row => <li key={row.key}><span><i className={styles.swatch} style={{ backgroundColor: SALES_COLORS[row.key] ?? SALES_COLORS.other }} aria-hidden="true"/>{statusLabel(row.key)}</span><div><strong>{count(row.orders)} pesanan</strong><small>{currency(row.amount)} nominal</small></div></li>)}</ul> : <p className={styles.note}>Tidak ada pesanan belum lunas yang dibuat pada periode ini.</p>}
  </article>
}

export function SalesFinancialComparison({ report, overTime = false }: { report: SalesReport; overTime?: boolean }) {
  const id = useId()
  const metrics: SalesMetric[] = ['gross', 'discount', 'net']
  const colors = ['#8a9099', SALES_COLORS.discount, SALES_COLORS.total]
  const options: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 0, font: { size: 10 } } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: gridColor }, ticks: { maxTicksLimit: 5, font: { size: 10 }, callback: value => axisValue('net', value) } },
    },
    plugins: {
      legend: { display: overTime, position: 'bottom', labels: { usePointStyle: true, boxWidth: 9, padding: 12, font: { size: 10 } } },
      tooltip: { callbacks: { label: context => `${context.dataset.label ?? context.label}: ${currency(context.parsed.y ?? 0)}` } },
    },
  }
  const data = overTime ? {
    labels: report.trend.map(point => displayDate(point.date)),
    datasets: metrics.map((metric, index) => ({ label: METRIC_LABELS[metric], data: report.trend.map(point => point.total[metric]), backgroundColor: colors[index], borderRadius: 3, maxBarThickness: 18 })),
  } : {
    labels: metrics.map(metric => METRIC_LABELS[metric]),
    datasets: [{ label: 'Nominal', data: metrics.map(metric => report.totals[metric]), backgroundColor: colors, borderRadius: 5, maxBarThickness: 56 }],
  }
  return <article className={styles.card} aria-labelledby={`${id}-title`}>
    <header className={styles.cardHeader}><div><h3 id={`${id}-title`}>Bruto, diskon & bersih</h3><p>Nilai historis pesanan lunas{overTime ? ' per interval pembayaran' : ''}.</p></div></header>
    {report.totals.orders > 0 ? <div className={styles.smallCanvas}><Bar data={data} options={options} role="img" aria-label="Perbandingan penjualan bruto, diskon, dan pendapatan bersih" aria-describedby={`${id}-summary`}/></div> : <EmptyChart/>}
    <p id={`${id}-summary`} className={styles.note}>Bruto <strong>{currency(report.totals.gross)}</strong> − diskon <strong>{currency(report.totals.discount)}</strong> = bersih <strong>{currency(report.totals.net)}</strong>.</p>
  </article>
}

export function SalesOrderVolumeChart({ report }: { report: SalesReport }) {
  const id = useId()
  const options: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: gridColor }, border: { display: false }, ticks: { precision: 0, maxTicksLimit: 5, font: { size: 10 }, callback: value => axisValue('orders', value) } },
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: context => `${count(context.parsed.y ?? 0)} pesanan lunas` } },
    },
  }
  return <article className={styles.card} aria-labelledby={`${id}-title`}>
    <header className={styles.cardHeader}><div><h3 id={`${id}-title`}>Volume pesanan lunas</h3><p>Setiap pesanan dihitung satu kali pada interval pembayarannya.</p></div></header>
    {report.totals.orders > 0 && report.trend.length ? <div className={styles.smallCanvas}><Line data={{ labels: report.trend.map(point => displayDate(point.date)), datasets: [{ label: 'Pesanan lunas', data: report.trend.map(point => point.total.orders), borderColor: SALES_COLORS.paid, backgroundColor: SALES_COLORS.paid, borderWidth: 2, pointRadius: report.trend.length === 1 ? 4 : 0, pointHoverRadius: 4, pointHitRadius: 12, tension: .2 }] }} options={options} role="img" aria-label="Jumlah pesanan lunas dari waktu ke waktu" aria-describedby={`${id}-summary`}/></div> : <EmptyChart/>}
    <p id={`${id}-summary`} className={styles.note}>{count(report.totals.orders)} pesanan lunas menghasilkan <strong>{currency(report.totals.net)}</strong>; rata-rata <strong>{currency(report.totals.aov)}</strong> per pesanan.</p>
  </article>
}
