'use client'

import { FileWarning, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type AccessPayload = {
  url: string
  expiresAt: string
  contentType: 'pdf' | 'video'
  mimeType: string
  fileName: string | null
  sessionId: string
  watermark: string
}

const watermarkPositions = [
  { left: '10%', top: '14%' },
  { left: '62%', top: '18%' },
  { left: '24%', top: '48%' },
  { left: '70%', top: '58%' },
  { left: '14%', top: '78%' },
  { left: '55%', top: '84%' },
]

export function ProtectedContentViewer({ productId, title }: { productId: string; title: string }) {
  const [access, setAccess] = useState<AccessPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  const [marker, setMarker] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/digital-products/${encodeURIComponent(productId)}/access`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as { message?: string } & Partial<AccessPayload>
        if (!response.ok || !body.url || !body.contentType || !body.watermark) {
          throw new Error(body.message || 'Materi belum dapat dimuat.')
        }
        return body as AccessPayload
      })
      .then(payload => { if (!cancelled) setAccess(payload) })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Materi belum dapat dimuat.') })
    return () => { cancelled = true }
  }, [productId])

  useEffect(() => {
    const onVisibility = () => {
      const nextHidden = document.visibilityState !== 'visible'
      setHidden(nextHidden)
      if (nextHidden) videoRef.current?.pause()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 's' || event.key.toLowerCase() === 'p') {
        event.preventDefault()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setMarker(current => (current + 1) % watermarkPositions.length), 11000)
    return () => window.clearInterval(timer)
  }, [])

  if (error) {
    return <div className="protected-content-state" role="alert"><FileWarning aria-hidden="true" /><h2>Materi belum dapat dibuka</h2><p>{error}</p></div>
  }
  if (!access) {
    return <div className="protected-content-state" role="status"><LoaderCircle className="is-spinning" aria-hidden="true" /><p>Menyiapkan akses aman…</p></div>
  }

  return (
    <section className="protected-content-viewer" onContextMenu={event => event.preventDefault()} aria-label={`Materi ${title}`}>
      <div className="protected-content-meta">
        <span><ShieldCheck aria-hidden="true" size={16} /> Akses terlindungi</span>
        <strong>{access.contentType === 'pdf' ? 'PDF' : 'Video'}</strong>
      </div>
      <div className={`protected-content-stage${hidden ? ' is-hidden' : ''}`}>
        {access.contentType === 'pdf' ? (
          <iframe
            className="protected-content-pdf"
            title={`Pembaca PDF ${title}`}
            src={`${access.url}#toolbar=0&navpanes=0`}
            referrerPolicy="no-referrer"
          />
        ) : (
          <video
            ref={videoRef}
            className="protected-content-video"
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            playsInline
            preload="metadata"
            src={access.url}
            onContextMenu={event => event.preventDefault()}
          >
            Browser Anda belum mendukung pemutar video HTML5.
          </video>
        )}

        <div className="protected-watermark-layer" aria-hidden="true">
          {watermarkPositions.map((position, index) => (
            <span key={index} style={position}>{access.watermark}</span>
          ))}
          <strong className="protected-watermark-moving" style={watermarkPositions[marker]}>{access.watermark}</strong>
        </div>
        {hidden ? <div className="protected-content-hidden"><ShieldCheck aria-hidden="true" /><span>Kembali ke tab Strativate untuk melanjutkan materi.</span></div> : null}
      </div>
      <p className="protected-content-note">Materi ini hanya untuk penggunaan akun pembeli di Strativate. Watermark membantu menelusuri redistribusi tanpa izin.</p>
    </section>
  )
}
