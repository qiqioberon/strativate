import type { ReactNode } from 'react'

import { getMarketingNavigation } from '@/lib/content/marketing-content'
import { isDigitalProductsEnabled } from '@/lib/features'

import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { MarketingMotion } from './marketing-motion'
import { WhatsAppCta } from './whatsapp-cta'

export function MarketingShell({
  children,
  digitalProductsEnabled = isDigitalProductsEnabled(),
}: {
  children: ReactNode
  digitalProductsEnabled?: boolean
}) {
  return (
    <div className="marketing-site">
      <SiteHeader navigation={getMarketingNavigation(digitalProductsEnabled)} />
      {children}
      <SiteFooter />
      <WhatsAppCta />
      <MarketingMotion />
    </div>
  )
}
