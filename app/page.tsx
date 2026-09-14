import type { Metadata } from 'next'

import { HomePage } from '@/components/marketing/home-page'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listPublicDigitalProducts } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'
import { listActiveHeroPosters } from '@/lib/marketing/hero-posters'
import { getPublicPrivateMentoring } from '@/lib/private-mentoring/server'

export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function Page() {
  const digitalProductsEnabled = isDigitalProductsEnabled()
  const [heroPosters, digitalProducts, privateMentoring] = await Promise.all([
    listActiveHeroPosters(),
    digitalProductsEnabled ? listPublicDigitalProducts() : Promise.resolve([]),
    getPublicPrivateMentoring(),
  ])

  return (
    <MarketingShell digitalProductsEnabled={digitalProductsEnabled}>
      <HomePage
        heroPosters={heroPosters}
        digitalProducts={digitalProducts}
        digitalProductsEnabled={digitalProductsEnabled}
        privateMentoring={privateMentoring}
      />
    </MarketingShell>
  )
}
