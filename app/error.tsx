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
        <p className="global-error-page__kicker">Something went wrong</p>
        <h1 id="global-error-title">Unable to load <em>this page.</em></h1>
        <p className="global-error-page__copy">We couldn&apos;t display this page. Check your connection and try again, or return to the homepage.</p>
        <div className="global-error-page__actions">
          <button className="button button-primary" type="button" onClick={reset}><RefreshCw aria-hidden="true" size={17} /> Try again</button>
          <a className="button global-error-page__secondary" href="/"><ArrowLeft aria-hidden="true" size={17} /> Back to Home</a>
        </div>
        <p className="global-error-page__hint">If the issue continues, refresh the page in a moment.</p>
      </section>
    </main>
  )
}
