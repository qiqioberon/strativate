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
      <div className={styles.visual} data-testid="route-loading-mark" aria-hidden="true">
        <span className={styles.ring} />
        <BrandLogo variant="mark" className={styles.markImage} priority />
      </div>
    </div>
  )
}
