import { notFound } from 'next/navigation'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listPublishedCompetitions } from '@/lib/content/editorial'

export default async function CompetitionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = (await listPublishedCompetitions()).find(competition => competition.slug === slug)
  if (!item) notFound()
  return <MarketingShell><main className="editorial-detail editorial-detail--competition"><article className="marketing-container"><p className="marketing-kicker">Competition</p><h1>{item.name}</h1><p className="editorial-detail__excerpt">{item.description}</p>{item.coverUrl ? <img className="editorial-detail__cover" src={item.coverUrl} alt="" /> : null}<div className="editorial-detail__facts"><span>Status<strong>{item.status}</strong></span>{item.registration_deadline ? <span>Registration deadline<strong>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(`${item.registration_deadline}T00:00:00`))}</strong></span> : null}</div><div className="editorial-detail__actions">{item.registration_url ? <a className="button button-primary" href={item.registration_url} target="_blank" rel="noreferrer">Register</a> : null}{item.rules_url ? <a className="button button-outline" href={item.rules_url} target="_blank" rel="noreferrer">Read rules</a> : null}</div></article></main></MarketingShell>
}
