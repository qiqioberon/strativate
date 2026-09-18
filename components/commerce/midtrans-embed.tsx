'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import type { SanitizedCheckout } from '@/lib/payments/types'

type SnapEmbedOptions = {
  embedId: string
  onSuccess: (result: unknown) => void
  onPending: (result: unknown) => void
  onError: (result: unknown) => void
  onClose: () => void
}

declare global {
  interface Window {
    snap?: {
      embed: (token: string, options: SnapEmbedOptions) => void
    }
  }
}

export function MidtransEmbed({
  orderId,
  clientKey,
  snapScriptUrl,
}: {
  orderId: string
  clientKey: string
  snapScriptUrl: string
}) {
  const router = useRouter()
  const embeddedToken = useRef<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [checkout, setCheckout] = useState<SanitizedCheckout | null>(null)
  const [message, setMessage] = useState('Klik Mulai pembayaran ketika kamu siap melanjutkan.')
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [canStart, setCanStart] = useState(true)
  const pollingAttempt = useRef(0)
  const reconciling = useRef(false)

  const reconcile = useCallback(async () => {
    if (reconciling.current) return
    reconciling.current = true
    setMessage('Memverifikasi pembayaran…')
    setError(null)
    try {
      const response = await fetch('/api/checkout/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const payload = await response.json() as SanitizedCheckout | { error?: string }
      if (!response.ok || !('order' in payload)) throw new Error('reconcile_failed')
      setCheckout(payload)
      if (payload.order.status === 'paid') {
        setMessage('Pembayaran terverifikasi. Pesanan sudah lunas.')
        setCanStart(false)
        router.refresh()
      } else if (payload.payment?.status === 'failed' || payload.payment?.status === 'expired' || payload.payment?.status === 'cancelled') {
        setMessage('Percobaan pembayaran berakhir. Kamu dapat membuat percobaan pembayaran baru.')
        embeddedToken.current = null
        setCanStart(true)
      } else {
        setMessage('Pembayaran masih menunggu konfirmasi.')
      }
    } catch {
      setError('Status pembayaran belum dapat diverifikasi. Sinkronkan status bila koneksi sudah stabil.')
      setMessage('Pembayaran belum dapat dikonfirmasi.')
    } finally {
      reconciling.current = false
    }
  }, [orderId, router])

  const startPayment = useCallback(async () => {
    if (starting) return
    setStarting(true)
    setCanStart(false)
    setError(null)
    setMessage('Menyiapkan pembayaran…')
    try {
      const response = await fetch('/api/checkout/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const payload = await response.json() as SanitizedCheckout | { error?: string }
      if (!response.ok || !('order' in payload)) throw new Error('start_failed')
      setCheckout(payload)
      if (payload.order.status === 'paid') {
        setMessage('Pembayaran sudah terverifikasi.')
        router.refresh()
        return
      }
      if (!payload.payment?.snapToken) throw new Error('missing_snap_token')
      setMessage(scriptReady ? 'Pilih metode pembayaran di bawah ini.' : 'Memuat layanan pembayaran…')
    } catch {
      setError('Pembayaran belum dapat dimulai. Pastikan konfigurasi Midtrans tersedia lalu coba lagi.')
      setMessage('Pembayaran belum siap.')
      setCanStart(true)
    } finally {
      setStarting(false)
    }
  }, [orderId, router, scriptReady, starting])

  useEffect(() => {
    const paymentStatus = checkout?.payment?.status
    if (!checkout?.payment || checkout.order.status === 'paid' || paymentStatus === 'failed' || paymentStatus === 'expired' || paymentStatus === 'cancelled') {
      pollingAttempt.current = 0
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const delays = [2500, 4000, 6500, 10000, 15000, 20000]

    const schedule = () => {
      if (cancelled || document.visibilityState !== 'visible' || pollingAttempt.current >= delays.length) return
      timer = setTimeout(async () => {
        if (cancelled) return
        pollingAttempt.current += 1
        await reconcile()
        schedule()
      }, delays[pollingAttempt.current])
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule()
      else if (timer) clearTimeout(timer)
    }

    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [checkout?.order.status, checkout?.payment, reconcile])

  useEffect(() => {
    const token = checkout?.payment?.snapToken
    if (!scriptReady || !token || !window.snap?.embed || checkout?.order.status === 'paid') return
    if (embeddedToken.current === token) return

    embeddedToken.current = token
    window.snap.embed(token, {
      embedId: 'midtrans-snap-container',
      onSuccess: () => { void reconcile() },
      onPending: () => {
        setMessage('Pembayaran sedang diproses.')
        void reconcile()
      },
      onError: () => {
        setError('Midtrans melaporkan kendala pada pembayaran. Status akan disinkronkan otomatis; gunakan fallback manual bila diperlukan.')
        void reconcile()
      },
      onClose: () => {
        embeddedToken.current = null
        setCanStart(true)
        setMessage('Pembayaran ditutup tanpa mengubah status pesanan. Kamu dapat melanjutkan lagi dari halaman ini.')
      },
    })
  }, [checkout, reconcile, scriptReady])

  if (!clientKey) {
    return <p className="checkout-payment-error">Konfigurasi pembayaran belum tersedia.</p>
  }

  const terminalAttempt = checkout?.payment?.status === 'failed'
    || checkout?.payment?.status === 'expired'
    || checkout?.payment?.status === 'cancelled'

  return (
    <section className="checkout-payment" aria-labelledby="payment-heading">
      <Script
        src={snapScriptUrl}
        data-client-key={clientKey}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setError('Snap.js belum dapat dimuat.')}
      />
      <div className="checkout-payment__head">
        <div>
          <span>Midtrans Snap</span>
          <h2 id="payment-heading">Pembayaran aman di dalam Strativate</h2>
        </div>
        {checkout?.payment ? <small>Status: {checkout.payment.status}</small> : null}
      </div>
      <p className="checkout-payment__message" role="status">{message}</p>
      {error ? <p className="checkout-payment-error" role="alert">{error}</p> : null}
      <div id="midtrans-snap-container" className="checkout-snap-container" />
      <div className="checkout-payment__actions">
        {canStart || terminalAttempt ? (
          <button
            className={buttonVariants({ variant: 'primary', size: 'marketing' })}
            type="button"
            disabled={starting}
            onClick={() => void startPayment()}
          >
            {starting ? 'Menyiapkan…' : checkout?.payment ? 'Lanjutkan pembayaran' : 'Mulai pembayaran'}
          </button>
        ) : null}
        {checkout?.payment ? (
          <button className={buttonVariants({ variant: 'outline', size: 'marketing' })} type="button" onClick={() => void reconcile()}>
            Sinkronkan status
          </button>
        ) : null}
      </div>
    </section>
  )
}
