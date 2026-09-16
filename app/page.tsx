import type { Metadata } from 'next'

import { HomePage } from '@/components/marketing/home-page'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listPublicDigitalProducts } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'
import { listActiveHeroPosters } from '@/lib/marketing/hero-posters'
import { listPublishedMentors } from '@/lib/mentor/public-profile'

export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function Page() {
  const digitalProductsEnabled = isDigitalProductsEnabled()
  const [heroPosters, mentors, digitalProducts] = await Promise.all([
    listActiveHeroPosters(),
    listPublishedMentors(),
    digitalProductsEnabled ? listPublicDigitalProducts() : Promise.resolve([]),
  ])

  return (
    <MarketingShell digitalProductsEnabled={digitalProductsEnabled}>
      <HomePage
        heroPosters={heroPosters}
        mentors={mentors}
        digitalProducts={digitalProducts}
        digitalProductsEnabled={digitalProductsEnabled}
      />
    </MarketingShell>
  )
}
