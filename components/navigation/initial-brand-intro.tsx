'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { BrandLogo } from '@/components/brand/brand-logo'
import { marketingNavigationItems } from '@/lib/content/marketing-content'

import styles from './initial-brand-intro.module.css'

const BOOTSTRAP_DURATION_MS = 2400
const INTRO_EXIT_HOLD_MS = 180
const INTRO_EXIT_DURATION_MS = 250
const REDUCED_MOTION_BOOTSTRAP_MS = 1200
const PROGRESS_TICK_MS = 45
const PREFETCH_ROUTES = marketingNavigationItems
  .map((item) => item.href)
  .filter((href) => href !== '/')

type IntroPhase = 'visible' | 'leaving' | 'hidden'

export function InitialBrandIntro() {
  const router = useRouter()
  const [phase, setPhase] = useState<IntroPhase>('visible')
  const [progress, setProgress] = useState(1)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let started = false
    let progressTimer: number | null = null
    let exitTimer: number | null = null
    let removeTimer: number | null = null

    const startBootstrap = () => {
      if (started) return
      started = true

      PREFETCH_ROUTES.forEach((href) => router.prefetch(href))

      const duration = reducedMotion ? REDUCED_MOTION_BOOTSTRAP_MS : BOOTSTRAP_DURATION_MS
      const startedAt = performance.now()

      const tick = () => {
        const elapsed = performance.now() - startedAt
        const nextProgress = Math.min(100, Math.max(1, Math.round((elapsed / duration) * 100)))
        setProgress(nextProgress)

        if (nextProgress < 100) return

        if (progressTimer !== null) window.clearInterval(progressTimer)
        progressTimer = null
        exitTimer = window.setTimeout(() => setPhase('leaving'), INTRO_EXIT_HOLD_MS)
        removeTimer = window.setTimeout(
          () => setPhase('hidden'),
          INTRO_EXIT_HOLD_MS + INTRO_EXIT_DURATION_MS,
        )
      }

      tick()
      progressTimer = window.setInterval(tick, PROGRESS_TICK_MS)
    }

    if (document.readyState === 'complete') startBootstrap()
    else window.addEventListener('load', startBootstrap, { once: true })

    return () => {
      window.removeEventListener('load', startBootstrap)
      if (progressTimer !== null) window.clearInterval(progressTimer)
      if (exitTimer !== null) window.clearTimeout(exitTimer)
      if (removeTimer !== null) window.clearTimeout(removeTimer)
    }
  }, [router])

  if (phase === 'hidden') return null

  return (
    <div
      className={`${styles.overlay} ${phase === 'leaving' ? styles.leaving : ''}`}
      data-testid="initial-brand-intro"
      data-page-motion-blocker="true"
      data-phase={phase}
      role="status"
      aria-live="polite"
      aria-label="Menyiapkan Strativate"
    >
      <span className={styles.sweep} aria-hidden="true" />
      <div className={styles.brandLockup}>
        <BrandLogo variant="wordmark" className={styles.wordmark} priority />
        <span className={styles.accent} aria-hidden="true" />
        <div className={styles.progressWrap}>
          <div className={styles.progressMeta}>
            <span>Menyiapkan halaman</span>
            <span data-testid="initial-load-percent">{progress}%</span>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Progress persiapan halaman"
            aria-valuemin={1}
            aria-valuemax={100}
            aria-valuenow={progress}
            data-testid="initial-load-progress"
          >
            <span className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
