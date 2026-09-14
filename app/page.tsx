import type { Metadata } from 'next'

import { HomePage } from '@/components/marketing/home-page'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listActiveHeroPosters } from '@/lib/marketing/hero-posters'

export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function Page() {
  const heroPosters = await listActiveHeroPosters()

  return (
    <MarketingShell>
      <HomePage heroPosters={heroPosters} />
    </MarketingShell>
  )
}
