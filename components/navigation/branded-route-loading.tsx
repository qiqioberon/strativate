import { BrandLogo } from '@/components/brand/brand-logo'

import styles from './branded-route-loading.module.css'

export function BrandedRouteLoading({
  label = 'Preparing your page',
}: {
  label?: string
}) {
  return (
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Preparing Strativate"
      data-testid="route-loading-overlay"
      data-page-motion-blocker="true"
    >
      <span className={styles.sweep} aria-hidden="true" />
      <div className={styles.content}>
        <BrandLogo variant="wordmark" className={styles.wordmark} />
        <span className={styles.accent} aria-hidden="true" />
        <span className={styles.label}>{label}</span>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Page loading progress"
          data-testid="route-loading-progress"
        >
          <span className={styles.progressIndicator} />
        </div>
      </div>
    </div>
  )
}
