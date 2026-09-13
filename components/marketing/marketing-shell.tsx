import type { ReactNode } from 'react'

import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { MarketingMotion } from './marketing-motion'
import { WhatsAppCta } from './whatsapp-cta'

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-site">
      <SiteHeader />
      {children}
      <SiteFooter />
      <WhatsAppCta />
      <MarketingMotion />
    </div>
  )
}
