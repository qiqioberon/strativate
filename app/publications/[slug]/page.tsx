import { notFound } from 'next/navigation'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listPublishedPublications } from '@/lib/content/editorial'

export default async function PublicationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = (await listPublishedPublications()).find(publication => publication.slug === slug)
  if (!item) notFound()
  return <MarketingShell><main className="editorial-detail"><article className="marketing-container"><p className="marketing-kicker">Publication</p><h1>{item.title}</h1><p className="editorial-detail__excerpt">{item.excerpt}</p>{item.coverUrl ? <img className="editorial-detail__cover" src={item.coverUrl} alt="" /> : null}<div className="editorial-detail__body">{item.body.split(/\n\s*\n/).map((paragraph, index) => <p key={`${item.id}-${index}`}>{paragraph}</p>)}</div></article></main></MarketingShell>
}
