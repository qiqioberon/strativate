import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { CompetitionDirectory } from '@/components/marketing/competition-directory'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { listPublishedCompetitions } from '@/lib/content/editorial'

export default async function CompetitionsPage() {
  const competitions = await listPublishedCompetitions()

  return (
    <MarketingShell>
      <main className="editorial-page editorial-page--competitions">
        <PageIntro
          title="Discover Top Competitions"
          description="Find approved competition opportunities and prepare for the challenge with a clearer plan."
        />
        <section className="marketing-section">
          <div className="marketing-container">
            <CompetitionDirectory competitions={competitions} />
          </div>
        </section>
        <section className="marketing-consultation-band editorial-competition-cta">
          <div className="marketing-container">
            <div>
              <p className="marketing-kicker">Competition support</p>
              <h2>Want to Create a Winning Proposal?</h2>
              <p>Explore mentoring and proposal review support for your next competition submission.</p>
            </div>
            <Link href="/program">Explore Programs <ArrowRight aria-hidden="true" size={17} /></Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
