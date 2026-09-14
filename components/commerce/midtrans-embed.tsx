'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import type { SanitizedCheckout } from '@/lib/payments/application'

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
  const [message, setMessage] = useState('Menyiapkan pembayaran…')
  const [error, setError] = useState<string | null>(null)
  const [requestNonce, setRequestNonce] = useState(0)

  const reconcile = useCallback(async () => {
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
        router.refresh()
      } else if (payload.payment?.status === 'failed' || payload.payment?.status === 'expired' || payload.payment?.status === 'cancelled') {
        setMessage('Percobaan pembayaran berakhir. Kamu dapat membuat percobaan pembayaran baru.')
        embeddedToken.current = null
      } else {
        setMessage('Pembayaran masih menunggu konfirmasi.')
      }
    } catch {
      setError('Status pembayaran belum dapat diverifikasi. Coba verifikasi lagi.')
      setMessage('Pembayaran belum dapat dikonfirmasi.')
    }
  }, [orderId, router])

  useEffect(() => {
    if (!scriptReady || !clientKey) return
    let cancelled = false

    async function start() {
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
        if (cancelled) return
        setCheckout(payload)
        if (payload.order.status === 'paid') {
          setMessage('Pembayaran sudah terverifikasi.')
          return
        }
        const token = payload.payment?.snapToken
        if (!token) throw new Error('missing_snap_token')
        if (!window.snap?.embed) throw new Error('snap_unavailable')
        if (embeddedToken.current === token) return
        embeddedToken.current = token
        setMessage('Pilih metode pembayaran di bawah ini.')
        window.snap.embed(token, {
          embedId: 'midtrans-snap-container',
          onSuccess: () => { void reconcile() },
          onPending: () => {
            setMessage('Pembayaran sedang diproses.')
            void reconcile()
          },
          onError: () => {
            setError('Midtrans melaporkan kendala pada pembayaran. Verifikasi status atau coba lagi.')
            void reconcile()
          },
          onClose: () => {
            setMessage('Pembayaran ditutup tanpa mengubah status pesanan. Kamu dapat melanjutkan lagi dari halaman ini.')
          },
        })
      } catch {
        if (!cancelled) {
          setError('Pembayaran belum dapat dimulai. Pastikan konfigurasi Midtrans tersedia lalu coba lagi.')
          setMessage('Pembayaran belum siap.')
        }
      }
    }

    void start()
    return () => { cancelled = true }
  }, [clientKey, orderId, reconcile, requestNonce, scriptReady])

  if (!clientKey) {
    return <p className="checkout-payment-error">Konfigurasi pembayaran belum tersedia.</p>
  }

  return (
    <section className="checkout-payment" aria-labelledby="payment-heading">
      <Script
        src={snapScriptUrl}
        data-client-key={clientKey}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
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
        <button className={buttonVariants({ variant: 'outline', size: 'marketing' })} type="button" onClick={() => void reconcile()}>
          Verifikasi status
        </button>
        {error || checkout?.payment?.status === 'failed' || checkout?.payment?.status === 'expired' || checkout?.payment?.status === 'cancelled' ? (
          <button
            className={buttonVariants({ variant: 'primary', size: 'marketing' })}
            type="button"
            onClick={() => {
              embeddedToken.current = null
              setRequestNonce(value => value + 1)
            }}
          >
            Coba pembayaran lagi
          </button>
        ) : null}
      </div>
    </section>
  )
}
