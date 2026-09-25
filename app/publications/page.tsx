import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PublicationDirectory } from '@/components/marketing/publication-directory'
import { listPublishedPublications } from '@/lib/content/editorial'

export default async function PublicationsPage() {
  const publications = await listPublishedPublications()
  return <MarketingShell><main className="editorial-page"><header className="editorial-hero editorial-hero--publications"><div className="marketing-container"><p className="marketing-kicker">Insights & Updates</p><h1>Publications <em>& News</em></h1><p>Updates on our partnerships, student achievements, learning resources, and community impact.</p></div></header><section className="marketing-section"><div className="marketing-container"><PublicationDirectory publications={publications}/></div></section></main></MarketingShell>
}
