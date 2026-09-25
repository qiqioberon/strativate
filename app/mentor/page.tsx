import { MessageCircle } from 'lucide-react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { MentorDirectory } from '@/components/marketing/mentor-directory'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import { listPublishedMentors } from '@/lib/mentor/public-profile'

export default async function MentorPage() {
  const mentors = await listPublishedMentors()

  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Meet Our Mentors"
          title={<>Learn from mentors<br /><em>who have been there.</em></>}
          description="Explore mentors by the expertise and public information available in Strativate's approved mentor directory. Profiles without photos use a clear neutral placeholder."
          motif="mentor"
          aside={<a className={buttonVariants({ variant: 'whatsapp', size: 'marketing' })} href={buildWhatsAppHref('Hello Strativate, I would like help choosing a suitable mentor.')} target="_blank" rel="noreferrer" data-testid="mentor-page-intro-whatsapp-link">Chat on WhatsApp <MessageCircle aria-hidden="true" size={17} /></a>}
        />
        <section className="marketing-page-section" data-reveal data-testid="mentor-directory-section">
          <div className="marketing-container">
            <MentorDirectory mentors={mentors} />
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
