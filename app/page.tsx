import type { Metadata } from 'next'

import { HomePage } from '@/components/marketing/home-page'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listPublicCatalog } from '@/lib/catalog/public'

export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function Page() {
  const catalogProducts = await listPublicCatalog()

  return (
    <MarketingShell>
      <HomePage catalogProducts={catalogProducts} />
    </MarketingShell>
  )
}
