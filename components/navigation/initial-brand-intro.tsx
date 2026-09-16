'use client'

import { useEffect, useState } from 'react'

import { BrandLogo } from '@/components/brand/brand-logo'

import styles from './initial-brand-intro.module.css'

const INTRO_EXIT_START_MS = 650
const INTRO_REMOVE_MS = 900
const REDUCED_MOTION_REMOVE_MS = 240

type IntroPhase = 'visible' | 'leaving' | 'hidden'

export function InitialBrandIntro() {
  const [phase, setPhase] = useState<IntroPhase>('visible')

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) {
      const removeTimer = window.setTimeout(() => setPhase('hidden'), REDUCED_MOTION_REMOVE_MS)
      return () => window.clearTimeout(removeTimer)
    }

    const exitTimer = window.setTimeout(() => setPhase('leaving'), INTRO_EXIT_START_MS)
    const removeTimer = window.setTimeout(() => setPhase('hidden'), INTRO_REMOVE_MS)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div
      className={`${styles.overlay} ${phase === 'leaving' ? styles.leaving : ''}`}
      data-testid="initial-brand-intro"
      data-phase={phase}
      aria-hidden="true"
    >
      <span className={styles.sweep} />
      <div className={styles.brandLockup}>
        <BrandLogo variant="wordmark" className={styles.wordmark} priority />
        <span className={styles.accent} />
      </div>
    </div>
  )
}
