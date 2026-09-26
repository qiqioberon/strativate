import type { Metadata } from 'next'

import { HomePage } from '@/components/marketing/home-page'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listHomepageDigitalProducts } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'
import { listActiveCompetitionRecognitions } from '@/lib/marketing/competition-recognitions'
import { listPublishedTestimonials } from '@/lib/marketing/testimonials'
import { listPublishedMentors } from '@/lib/mentor/public-profile'

export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function Page() {
  const digitalProductsEnabled = isDigitalProductsEnabled()
  const [mentors, testimonials, digitalProducts, recognitions] = await Promise.all([
    listPublishedMentors(),
    listPublishedTestimonials(),
    digitalProductsEnabled ? listHomepageDigitalProducts() : Promise.resolve([]),
    listActiveCompetitionRecognitions(),
  ])

  return (
    <MarketingShell digitalProductsEnabled={digitalProductsEnabled}>
      <HomePage
        mentors={mentors}
        testimonials={testimonials}
        digitalProducts={digitalProducts}
        digitalProductsEnabled={digitalProductsEnabled}
        recognitions={recognitions}
      />
    </MarketingShell>
  )
}
