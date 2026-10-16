'use client'

import { Download, ExternalLink, Eye, FileText, RefreshCw, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { receiptEndpoint, receiptFilename } from '@/lib/commerce/payment-receipt'
import type { CommerceLanguage } from '@/lib/commerce/presentation'
import styles from './payment-receipt.module.css'

export function PaymentReceiptActions({ orderId, language = 'en' }: { orderId: string; language?: CommerceLanguage }) {
  const english = language === 'en'
  const label = (en: string, id: string) => english ? en : id
  const [open, setOpen] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(false), [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null), previewButton = useRef<HTMLButtonElement>(null)
  const downloadRequest = useRef<AbortController | null>(null)
  const downloadUrls = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const id = useId()
  const unavailable = label('Unable to prepare the receipt. Please try again.', 'Bukti pembayaran belum dapat dibuat. Silakan coba lagi.')

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const previousOverflow = document.body.style.overflow
    if (open && !element.open) { element.showModal(); document.body.style.overflow = 'hidden' }
    if (!open && element.open) { element.close(); previewButton.current?.focus() }
    return () => { if (element.open) element.close(); document.body.style.overflow = previousOverflow }
  }, [open])

  useEffect(() => {
    if (!open) { setPdfUrl(''); return }
    const controller = new AbortController()
    let current = true, url = ''
    setLoading(true); setError(''); setPdfUrl('')
    void (async () => {
      try {
        const response = await fetch(receiptEndpoint(orderId), { signal: controller.signal, cache: 'no-store' })
        if (!response.ok || !response.headers.get('content-type')?.startsWith('application/pdf')) throw new Error('Receipt unavailable')
        const blob = await response.blob()
        if (!current) return
        url = URL.createObjectURL(blob)
        setPdfUrl(url)
      } catch {
        if (current && !controller.signal.aborted) setError(unavailable)
      } finally { if (current) setLoading(false) }
    })()
    return () => { current = false; controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [open, orderId, retry, unavailable])

  useEffect(() => {
    const urls = downloadUrls.current
    return () => {
      downloadRequest.current?.abort()
      urls.forEach((timer, url) => { clearTimeout(timer); URL.revokeObjectURL(url) })
      urls.clear()
    }
  }, [])

  async function download() {
    if (downloadRequest.current) return
    const controller = new AbortController()
    downloadRequest.current = controller
    setDownloading(true); setError('')
    try {
      const response = await fetch(receiptEndpoint(orderId, true), { signal: controller.signal, cache: 'no-store' })
      if (!response.ok || !response.headers.get('content-type')?.startsWith('application/pdf')) throw new Error('Receipt unavailable')
      const blob = await response.blob()
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = receiptFilename(orderId)
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      const timer = setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.current.delete(url) }, 1000)
      downloadUrls.current.set(url, timer)
    } catch { if (!controller.signal.aborted) setError(unavailable) }
    finally {
      if (!controller.signal.aborted) setDownloading(false)
      downloadRequest.current = null
    }
  }

  return <div className={styles.receiptActions}>
    <div className={styles.actions}>
      <button type="button" ref={previewButton} className={styles.button} onClick={() => setOpen(true)}><Eye size={15} aria-hidden="true" />{label('Preview Receipt', 'Pratinjau Bukti Pembayaran')}</button>
      <button type="button" className={styles.button} disabled={downloading} onClick={() => void download()}><Download size={15} aria-hidden="true" />{downloading ? label('Preparing PDF…', 'Menyiapkan PDF…') : label('Download PDF', 'Unduh PDF')}</button>
    </div>
    {error && !open ? <p className={styles.error} role="alert">{error}</p> : null}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={id} onCancel={event => { event.stopPropagation(); event.preventDefault(); setOpen(false) }} onClose={event => { event.stopPropagation(); setOpen(false) }}>
      <div className={styles.surface}>
        <header className={styles.header}>
          <span className={styles.documentIcon}><FileText size={21} aria-hidden="true"/></span>
          <div><h3 id={id}>{label('Payment Receipt', 'Bukti Pembayaran')}</h3><p>PDF · #STR-{orderId.slice(0, 8).toUpperCase()}</p></div>
          <button type="button" className={styles.close} autoFocus onClick={() => setOpen(false)} aria-label={label('Close receipt preview', 'Tutup pratinjau')}><X size={19} aria-hidden="true" /></button>
        </header>
        <div className={styles.preview} aria-busy={loading}>
          {loading ? <p className={styles.message} role="status">{label('Preparing receipt…', 'Menyiapkan bukti pembayaran…')}</p> : null}
          {error ? <div className={styles.message} role="alert"><p>{error}</p><button type="button" className={styles.button} onClick={() => setRetry(value => value + 1)}><RefreshCw size={14} aria-hidden="true" />{label('Try again', 'Coba lagi')}</button></div> : null}
          {pdfUrl ? <object className={styles.pdf} data={pdfUrl} type="application/pdf" aria-label={label('PDF payment receipt preview', 'Pratinjau PDF bukti pembayaran')}><p className={styles.message}>{label('Your browser cannot display this PDF here. Open it in a new tab or download it below.', 'Browser tidak mendukung pratinjau PDF. Buka di tab baru atau unduh PDF di bawah.')}</p></object> : null}
        </div>
        <footer className={styles.footer}>
          <p>{label('Open in a new tab for a full-size view.', 'Buka di tab baru untuk tampilan penuh.')}</p>
          <div className={styles.actions}>
            {pdfUrl ? <a className={styles.button} href={receiptEndpoint(orderId)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true"/>{label('Open in New Tab', 'Buka di Tab Baru')}</a> : <button type="button" className={styles.button} disabled><ExternalLink size={16} aria-hidden="true"/>{label('Open in New Tab', 'Buka di Tab Baru')}</button>}
            <button type="button" className={`${styles.button} ${styles.primary}`} disabled={downloading || loading} onClick={() => void download()}><Download size={16} aria-hidden="true" />{downloading ? label('Preparing…', 'Menyiapkan…') : label('Download PDF', 'Unduh PDF')}</button>
          </div>
        </footer>
      </div>
    </dialog>
  </div>
}
