import { BrandLogo } from '@/components/brand/brand-logo'

import styles from './branded-route-loading.module.css'

export function BrandedRouteLoading({
  label = 'Menyiapkan halaman',
}: {
  label?: string
}) {
  return (
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="route-loading-overlay"
    >
      <span className={styles.sweep} aria-hidden="true" />
      <div className={styles.content}>
        <BrandLogo variant="wordmark" className={styles.wordmark} />
        <span className={styles.accent} aria-hidden="true" />
        <span className={styles.label}>{label}</span>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label={label}
          data-testid="route-loading-progress"
        >
          <span className={styles.progressIndicator} />
        </div>
      </div>
    </div>
  )
}
