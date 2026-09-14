import type { ReactNode } from 'react'

import { getAccount } from '@/lib/auth/server'
import { getMarketingNavigation } from '@/lib/content/marketing-content'
import { isDigitalProductsEnabled } from '@/lib/features'

import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { MarketingMotion } from './marketing-motion'
import { WhatsAppCta } from './whatsapp-cta'

export async function MarketingShell({
  children,
  digitalProductsEnabled = isDigitalProductsEnabled(),
}: {
  children: ReactNode
  digitalProductsEnabled?: boolean
}) {
  const account = await getAccount()
  const showCart = Boolean(
    digitalProductsEnabled
    && account?.profile.role === 'mentee'
    && account.mentee?.onboarding_completed_at,
  )

  return (
    <div className="marketing-site">
      <SiteHeader
        navigation={getMarketingNavigation(digitalProductsEnabled)}
        showCart={showCart}
        accountHref={account?.destination ?? null}
      />
      {children}
      <SiteFooter />
      <WhatsAppCta />
      <MarketingMotion />
    </div>
  )
}
