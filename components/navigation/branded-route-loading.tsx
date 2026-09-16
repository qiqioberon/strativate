import { BrandLogo } from '@/components/brand/brand-logo'

import styles from './branded-route-loading.module.css'

export function BrandedRouteLoading() {
  return (
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="route-loading-overlay"
    >
      <span className={styles.srOnly}>Memuat halaman</span>
      <div className={styles.visual} aria-hidden="true">
        <div className={styles.wordmark} data-testid="route-loading-wordmark">
          <BrandLogo variant="wordmark" className={styles.wordmarkImage} priority />
        </div>
        <div className={styles.mark} data-testid="route-loading-mark">
          <span className={styles.ring} />
          <BrandLogo variant="mark" className={styles.markImage} priority />
        </div>
      </div>
    </div>
  )
}
