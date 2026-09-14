'use client'

import { ArrowLeft, RefreshCw, WifiOff } from 'lucide-react'

import { BrandLogo } from '@/components/brand/brand-logo'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="global-error-page">
      <div className="global-error-page__orb global-error-page__orb--one" aria-hidden="true" />
      <div className="global-error-page__orb global-error-page__orb--two" aria-hidden="true" />
      <section className="global-error-page__panel" aria-labelledby="global-error-title">
        <div className="global-error-page__brand"><BrandLogo priority /></div>
        <div className="global-error-page__icon" aria-hidden="true"><WifiOff size={30} /></div>
        <p className="global-error-page__kicker">Ada gangguan kecil</p>
        <h1 id="global-error-title">Belum dapat <em>dimuat.</em></h1>
        <p className="global-error-page__copy">Kami belum berhasil menampilkan halaman ini. Periksa koneksi lalu coba lagi, atau kembali ke beranda untuk melanjutkan dari sana.</p>
        <div className="global-error-page__actions">
          <button className="button button-primary" type="button" onClick={reset}><RefreshCw aria-hidden="true" size={17} /> Coba lagi</button>
          <a className="button global-error-page__secondary" href="/"><ArrowLeft aria-hidden="true" size={17} /> Kembali ke beranda</a>
        </div>
        <p className="global-error-page__hint">Jika masalah tetap muncul, muat ulang halaman beberapa saat lagi.</p>
      </section>
    </main>
  )
}
