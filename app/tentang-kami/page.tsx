import { ArrowRight, Focus, MessageCircle, Repeat2, Waypoints } from 'lucide-react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { preparationPrinciples } from '@/lib/content/marketing-content'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'

const icons = [Focus, Waypoints, Repeat2]

export default function AboutPage() {
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Who We Are"
          title={<>Future-ready skills meet<br /><em>competition success.</em></>}
          description="Strativate helps students build practical business skills, sharpen analytical thinking, and prepare for competitions with expert guidance."
          motif="about"
          aside={<a className={buttonVariants({ variant: 'whatsapp', size: 'marketing' })} href={buildWhatsAppHref('Hello Strativate, I would like to learn more about your approach and services.')} target="_blank" rel="noreferrer" data-testid="about-page-intro-whatsapp-link">Chat on WhatsApp <MessageCircle aria-hidden="true" size={17} /></a>}
        />
        <section className="marketing-page-section marketing-about-page" data-reveal data-testid="about-story-section">
          <div className="marketing-container marketing-about-page__statement">
            <span>STRATIVATE / APPROACH</span>
            <h2>Our training helps participants build practical skills and <em>move toward competition success with confidence.</em></h2>
          </div>
          <div className="marketing-container marketing-about-page__principles">
            {preparationPrinciples.map((principle, index) => {
              const Icon = icons[index]
              return <article key={principle.number}><Icon aria-hidden="true" size={22} /><span>{principle.number}</span><h3>{principle.title}</h3><p>{principle.description}</p></article>
            })}
          </div>
        </section>
        <section className="marketing-consultation-band marketing-consultation-band--dark" data-reveal data-testid="about-consultation-section"><div className="marketing-container"><div><p className="marketing-kicker">Start a conversation</p><h2>The right preparation starts with your goal.</h2></div><a href={buildWhatsAppHref('Hello Strativate, I would like to learn more about your approach and services.')} target="_blank" rel="noreferrer" data-testid="about-whatsapp-link">Contact Strativate <ArrowRight aria-hidden="true" size={17} /></a></div></section>
      </main>
    </MarketingShell>
  )
}
