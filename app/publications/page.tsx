import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listPublishedPublications } from '@/lib/content/editorial'

export default async function PublicationsPage() {
  const publications = await listPublishedPublications()
  return <MarketingShell><main className="editorial-page"><header className="editorial-hero"><div className="marketing-container"><p className="marketing-kicker">Publications</p><h1>Ideas worth<br /><em>sharing.</em></h1><p>Explore approved insights, research, and learning resources from the Strativate community.</p></div></header><section className="marketing-section"><div className="marketing-container"><div className="editorial-grid">{publications.length ? publications.map(item => <article className="editorial-card" key={item.id}>{item.coverUrl ? <img src={item.coverUrl} alt="" /> : null}<div><span>{item.published_at ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(`${item.published_at}T00:00:00`)) : 'Published by Strativate'}</span><h2>{item.title}</h2><p>{item.excerpt}</p><Link className="marketing-text-link" href={`/publications/${item.slug}`}>Read publication <span aria-hidden="true">→</span></Link></div></article>) : <div className="editorial-empty"><strong>Publications are coming soon.</strong><span>Approved articles and resources will appear here when ready.</span></div>}</div></div></section></main></MarketingShell>
}
