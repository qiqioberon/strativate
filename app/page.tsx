import type { Metadata } from 'next'

import { HomePage } from '@/components/marketing/home-page'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listPublicCatalog } from '@/lib/catalog/public'
import { listActiveHeroPosters } from '@/lib/marketing/hero-posters'

export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function Page() {
  const [catalogProducts, heroPosters] = await Promise.all([listPublicCatalog(), listActiveHeroPosters()])

  return (
    <MarketingShell>
      <HomePage catalogProducts={catalogProducts} heroPosters={heroPosters} />
    </MarketingShell>
  )
}
