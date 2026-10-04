import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { PublicationDirectory } from '@/components/marketing/publication-directory'
import { listPublishedPublications } from '@/lib/content/editorial'

export default async function PublicationsPage() {
  const publications = await listPublishedPublications()

  return (
    <MarketingShell>
      <main className="editorial-page">
        <PageIntro
          title="Publications & News"
          description="Updates on our partnerships, student achievements, learning resources, and community impact."
        />
        <section className="marketing-section">
          <div className="marketing-container">
            <PublicationDirectory publications={publications} />
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
