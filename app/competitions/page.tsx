import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { listPublishedCompetitions } from '@/lib/content/editorial'

export default async function CompetitionsPage() {
  const competitions = await listPublishedCompetitions()
  return <MarketingShell><main className="editorial-page"><header className="editorial-hero editorial-hero--competition"><div className="marketing-container"><p className="marketing-kicker">Competitions</p><h1>Find your next<br /><em>challenge.</em></h1><p>Browse approved competition opportunities and prepare with a clearer strategy.</p></div></header><section className="marketing-section"><div className="marketing-container"><div className="editorial-grid">{competitions.length ? competitions.map(item => <article className="editorial-card" key={item.id}>{item.coverUrl ? <img src={item.coverUrl} alt="" /> : null}<div><span>{item.status.replace('_', ' ')}</span><h2>{item.name}</h2><p>{item.description}</p>{item.registration_deadline ? <small>Registration deadline: {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(`${item.registration_deadline}T00:00:00`))}</small> : null}<Link className="marketing-text-link" href={`/competitions/${item.slug}`}>View competition <span aria-hidden="true">→</span></Link></div></article>) : <div className="editorial-empty"><strong>Competition listings are coming soon.</strong><span>Approved opportunities will appear here when their details are ready.</span></div>}</div></div></section></main></MarketingShell>
}
