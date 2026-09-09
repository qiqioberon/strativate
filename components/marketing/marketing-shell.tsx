import type { ReactNode } from 'react'

import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-site">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  )
}
