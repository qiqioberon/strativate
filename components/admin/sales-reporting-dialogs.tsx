'use client'

import { ChevronDown, Download, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatRupiah } from '@/lib/commerce/money'
import { SALES_EXPORT_DEFAULT_COLUMNS, SALES_EXPORT_FIELDS } from '@/lib/admin/sales-export'
import { displayDate, itemKindLabel, paymentMethodLabel, statusLabel, type SalesComparison, type SalesScope, type SalesTransaction, type SalesTransactionFilters } from '@/lib/admin/sales-reporting'
import styles from './sales-reporting.module.css'

let scrollLocks = 0
let previousBodyOverflow = ''

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!open) {
      if (dialog.open) dialog.close()
      return
    }
    if (!dialog.open) dialog.showModal()
    if (scrollLocks === 0) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    scrollLocks += 1
    let released = false
    function releaseScroll() {
      if (released) return
      released = true
      scrollLocks -= 1
      if (scrollLocks === 0) document.body.style.overflow = previousBodyOverflow
    }
    dialog.addEventListener('close', releaseScroll)
    return () => {
      dialog.removeEventListener('close', releaseScroll)
      if (dialog.open) dialog.close()
      releaseScroll()
    }
  }, [open])
  return ref
}

export function SalesOrderDialog({ order, onClose }: { order: SalesTransaction | null; onClose: () => void }) {
  const ref = useDialog(Boolean(order))
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="sales-order-title" onClose={onClose}>
    {order ? <div className={styles.dialogSurface}>
      <header className={styles.dialogHeader}>
        <div><h2 id="sales-order-title">Order details</h2><p>{order.invoice ?? `#STR-${order.order_id.slice(0, 8).toUpperCase()}`} · {order.customer ?? 'Customer'} · {order.email ?? '—'}</p></div>
        <button type="button" className={styles.iconButton} aria-label="Close transaction details" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </header>
      <div className={styles.dialogBody}>
        <section className={styles.dialogSection}>
          <h3>Order details</h3>
          <dl className={styles.detailGrid}>
            <div><dt>Order</dt><dd>#STR-{order.order_id.slice(0, 8).toUpperCase()}</dd></div>
            <div><dt>Status</dt><dd><span className={styles.status} data-status={order.status}>{statusLabel(order.status)}</span></dd></div>
            <div><dt>Created · WIB</dt><dd>{displayDate(order.created_at, true)}</dd></div>
            <div><dt>Paid · WIB</dt><dd>{displayDate(order.paid_at, true)}</dd>{!order.paid_at && order.recognized_at ? <small>Historical reporting date: {displayDate(order.recognized_at, true)}</small> : null}</div>
          </dl>
        </section>
        <section className={styles.dialogSection}>
          <h3>Financials</h3>
          <dl className={styles.detailGrid}>
            <div><dt>Subtotal</dt><dd className={styles.money}>{formatRupiah(order.gross)}</dd></div>
            <div><dt>Discount{order.discount_code ? ` · ${order.discount_code}` : ''}</dt><dd className={styles.money}>{order.discount > 0 ? '−' : ''}{formatRupiah(order.discount)}</dd></div>
          </dl>
        </section>
        <section className={styles.dialogSection}>
          <h3>Order items</h3>
          {order.items.map(item => <article key={item.id} className={styles.lineItem}>
            <div className={styles.lineItemInfo}>
              <strong>{item.name}</strong><span>{itemKindLabel(item.kind)} · {item.quantity} item</span>
              {item.kind === 'private_mentoring' ? <small>{[item.tier, item.sessions !== null ? `${item.sessions} sessions purchased` : 'Session count unknown', item.purchase_type === 'top_up' ? 'Top-up' : item.purchase_type === 'new_enrollment' ? 'New purchase' : null].filter(Boolean).join(' · ')}</small> : null}
              {item.sessions_per_month !== null ? <small>{item.sessions_per_month} sessions/month</small> : null}
            </div>
            <div className={styles.itemAmounts}>
              <div><span>Original unit price</span><strong>{formatRupiah(Math.round(item.gross / Math.max(1, item.quantity)))}</strong></div>
              <div><span>Net unit price</span><strong>{formatRupiah(Math.round(item.net / Math.max(1, item.quantity)))}</strong></div>
              {item.discount > 0 ? <div><span>Item discount</span><strong>−{formatRupiah(item.discount)}</strong></div> : null}
              <div className={styles.itemTotal}><span>Item total</span><strong>{formatRupiah(item.net)}</strong></div>
            </div>
          </article>)}
        </section>
        <section className={styles.dialogSection}>
          <h3>Payment</h3>
          {order.payment ? <dl className={styles.detailGrid}>
            <div><dt>Method</dt><dd>{paymentMethodLabel(order.payment.method)}</dd></div>
            <div><dt>Payment status</dt><dd>{statusLabel(order.payment.status)}</dd></div>
            <div><dt>Provider</dt><dd>{order.payment.provider}</dd></div>
            {order.payment.provider_status ? <div><dt>Provider status</dt><dd>{order.payment.provider_status}</dd></div> : null}
            <div><dt>Updated · WIB</dt><dd>{displayDate(order.payment.updated_at, true)}</dd></div>
          </dl> : <p className={styles.methodNote}>No payment recorded.</p>}
          <details className={styles.technical}>
            <summary>Technical identifiers<ChevronDown size={13} aria-hidden="true" /></summary>
            <dl>
              <div><dt>Order UUID</dt><dd>{order.order_id}</dd></div>
              {order.payment?.provider_order_id ? <div><dt>Provider Order ID</dt><dd>{order.payment.provider_order_id}</dd></div> : null}
              {order.payment?.reference ? <div><dt>Provider transaction reference</dt><dd>{order.payment.reference}</dd></div> : null}
              {order.payment?.method ? <div><dt>Source payment method</dt><dd>{order.payment.method}</dd></div> : null}
            </dl>
          </details>
        </section>
      </div>
      <footer className={styles.dialogFooter}><span>Order net total</span><strong>{formatRupiah(order.net)}</strong></footer>
    </div> : null}
  </dialog>
}

type ExportProps = SalesComparison & { open: boolean; onClose: () => void; from: string | null; to: string; scope: SalesScope; filters: SalesTransactionFilters; rangeLabel: string; comparisonLabel: string }
export function SalesExportDialog({ open, onClose, from, to, scope, compareMode, compareFrom, compareTo, filters, rangeLabel, comparisonLabel }: ExportProps) {
  const ref = useDialog(open)
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [dataset, setDataset] = useState<'orders' | 'items' | 'both'>('both')
  const [columns, setColumns] = useState<string[]>(SALES_EXPORT_DEFAULT_COLUMNS)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const busyRef = useRef(false)
  useEffect(() => { if (open) setError('') }, [open])
  const applicable = SALES_EXPORT_FIELDS.filter(field => dataset === 'both' || field.datasets.includes(dataset))
  const groups = [...new Set(applicable.map(field => field.group))]
  const selectedColumns = applicable.filter(field => columns.includes(field.key)).map(field => field.key)
  function toggle(key: string) { setColumns(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]) }

  async function download() {
    if (busyRef.current || !selectedColumns.length) return
    busyRef.current = true; setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/sales-reporting/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format, dataset, from, to, scope, compareMode, compareFrom, compareTo, columns: selectedColumns, filters }) })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null
        setError(body?.message ?? 'Unable to prepare the file. Please try again.'); return
      }
      const blob = await response.blob(), url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `strativate-${format === 'xlsx' ? 'sales' : dataset}-${from ?? 'all'}_${to}.${format}`
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      onClose()
    } catch { setError('Unable to finish the export. Check your connection and try again.') }
    finally { busyRef.current = false; setBusy(false) }
  }

  return <dialog ref={ref} className={styles.dialog} aria-labelledby="sales-export-title" onCancel={event => { if (busy) event.preventDefault() }} onClose={onClose}>
    <div className={styles.dialogSurface} aria-busy={busy}>
      <header className={styles.dialogHeader}>
        <div><h2 id="sales-export-title">Export report</h2></div>
        <button type="button" className={styles.iconButton} aria-label="Close export" disabled={busy} onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </header>
      <div className={styles.dialogBody}>
        <fieldset className={styles.exportSection} disabled={busy}><legend>File format</legend><div className={styles.actions}>{(['xlsx', 'csv'] as const).map(value => <label key={value} className={styles.checkbox}><input type="radio" name="sales-export-format" value={value} checked={format === value} onChange={() => { setFormat(value); if (value === 'csv' && dataset === 'both') setDataset('orders') }} /><span>{value === 'xlsx' ? 'Excel (.xlsx)' : 'CSV (.csv)'}</span></label>)}</div></fieldset>
        <label className={styles.field}><span>Dataset</span><select value={dataset} disabled={busy} onChange={event => setDataset(event.target.value as typeof dataset)}><option value="orders">Orders · one row per order</option><option value="items">Items · one row per item</option>{format === 'xlsx' ? <option value="both">Orders & Items · two worksheets</option> : null}</select></label>
        <section className={styles.exportSection}>
          <h3>Reporting period</h3><p>{rangeLabel} · WIB</p>
          {compareMode !== 'none' && comparisonLabel ? <p className={styles.methodNote}>Comparison: {comparisonLabel}{format === 'xlsx' ? ' · Excel Summary' : ' · available in Excel Summary'}</p> : null}
          <p className={styles.methodNote}>Transactions follow the main period, business scope, search, status, payment method and current sort order.</p>
          <p className={styles.methodNote}>Orders includes each order total once. Items includes item amounts in the selected scope. Excel Summary uses the KPI period and scope, including the selected comparison.</p>
        </section>
        <div className={styles.columnHeading}><h3>Export columns</h3><button type="button" className={styles.textButton} disabled={busy} onClick={() => setColumns(applicable.map(field => field.key))}>Select all</button><button type="button" className={styles.textButton} disabled={busy} onClick={() => setColumns(SALES_EXPORT_DEFAULT_COLUMNS)}>Default</button></div>
        {groups.map(group => <fieldset key={group} className={styles.exportSection} disabled={busy}><legend>{group}</legend><div className={styles.columnGrid}>{applicable.filter(field => field.group === group).map(field => <label className={styles.checkbox} key={field.key}><input type="checkbox" checked={columns.includes(field.key)} onChange={() => toggle(field.key)} /><span>{field.label}</span></label>)}</div></fieldset>)}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {busy ? <p className={styles.loading} role="status">Preparing file…</p> : null}
      </div>
      <footer className={styles.dialogFooter}><button type="button" className={styles.button} disabled={busy} onClick={onClose}>Cancel</button><button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy || !selectedColumns.length} onClick={() => void download()}><Download size={15} aria-hidden="true" />{busy ? 'Preparing file…' : format === 'xlsx' ? 'Export Excel' : 'Export CSV'}</button></footer>
    </div>
  </dialog>
}
