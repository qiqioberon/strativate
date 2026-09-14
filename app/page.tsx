import type { Metadata } from 'next'

import { HomePage } from '@/components/marketing/home-page'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listPublicDigitalProducts } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'
import { listActiveHeroPosters } from '@/lib/marketing/hero-posters'

export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function Page() {
  const digitalProductsEnabled = isDigitalProductsEnabled()
  const heroPosters = await listActiveHeroPosters()
  const digitalProducts = digitalProductsEnabled ? await listPublicDigitalProducts() : []

  return (
    <MarketingShell digitalProductsEnabled={digitalProductsEnabled}>
      <HomePage
        heroPosters={heroPosters}
        digitalProducts={digitalProducts}
        digitalProductsEnabled={digitalProductsEnabled}
      />
    </MarketingShell>
  )
}
