import { notFound } from 'next/navigation'

import { PublicationDetailView } from '@/components/marketing/editorial-detail-views'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { getPublishedPublicationBySlug, listPublishedPublications } from '@/lib/content/editorial'

export default async function PublicationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = await getPublishedPublicationBySlug(slug)
  if (!item) notFound()

  const related = (await listPublishedPublications())
    .filter(publication => publication.id !== item.id && publication.category_id === item.category_id)
    .slice(0, 3)
    .map(publication => ({
      id: publication.id,
      slug: publication.slug,
      title: publication.title,
      summary: publication.excerpt,
      category: publication.categoryName,
      coverUrl: publication.coverUrl,
      coverAltText: publication.cover_alt_text,
    }))

  return <MarketingShell>
    <PublicationDetailView
      item={{
        id: item.id,
        slug: item.slug,
        title: item.title,
        summary: item.excerpt,
        category: item.categoryName,
        publicationDate: item.published_at,
        coverUrl: item.coverUrl,
        coverAltText: item.cover_alt_text,
        body: item.bodyDocument,
      }}
      related={related}
    />
  </MarketingShell>
}
