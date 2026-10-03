import { notFound } from 'next/navigation'

import { CompetitionDetailView } from '@/components/marketing/editorial-detail-views'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { getPublishedCompetitionBySlug } from '@/lib/content/editorial'

export default async function CompetitionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = await getPublishedCompetitionBySlug(slug)
  if (!item) notFound()

  return <MarketingShell>
    <CompetitionDetailView item={{
      id: item.id,
      slug: item.slug,
      name: item.name,
      description: item.description,
      category: item.categoryName,
      status: item.status,
      registrationDeadline: item.registration_deadline,
      registrationUrl: item.registration_url,
      rulesUrl: item.rules_url,
      coverUrl: item.coverUrl,
      coverAltText: item.cover_alt_text,
    }} />
  </MarketingShell>
}
