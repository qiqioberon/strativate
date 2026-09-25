import { ArrowRight, MessageCircle } from 'lucide-react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { ProgramKineticSurface } from '@/components/marketing/program-kinetic'
import { ServiceCard } from '@/components/marketing/service-card'
import { buttonVariants } from '@/components/ui/button'
import { services } from '@/lib/content/services'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'

import './program-page.css'
import './program-layout-fix.css'

const journey = [
  { number: '01', title: 'Define your goal', copy: 'Start with your target, challenge, and preparation timeline.' },
  { number: '02', title: 'Choose your format', copy: 'Compare personal, intensive, class, or review-based support.' },
  { number: '03', title: 'Start preparing', copy: 'Enter the most relevant program and move with a clearer plan.' },
]

export default function ProgramPage() {
  const primaryServices = services.filter(service => service.id === 'private-mentoring' || service.id === 'intensive-mentoring')
  const secondaryService = services.find(service => service.id === 'big-class')
  const supportingServices = services.filter(service => !primaryServices.includes(service) && service !== secondaryService)

  return (
    <MarketingShell>
      <main className="program-page">
        <PageIntro
          eyebrow="Our Programs"
          title={<>Build skills for<br /><em>competition success.</em></>}
          description="Comprehensive mentoring and coaching services to help you win in business competitions and build future-ready skills."
          motif="program"
          aside={(
            <div className="program-intro-panel">
              <div className="program-intro-facts" aria-label="Strativate service summary">
                <span><strong>08</strong> services</span>
                <span><strong>02</strong> core programs</span>
                <span><strong>01</strong> clearer path</span>
              </div>
              <a className={buttonVariants({ variant: 'whatsapp', size: 'marketing' })} href={buildWhatsAppHref('Hello Strativate, I would like help choosing the right Strativate program.')} target="_blank" rel="noreferrer" data-testid="program-page-intro-whatsapp-link">
                Chat on WhatsApp <MessageCircle aria-hidden="true" size={17} />
              </a>
            </div>
          )}
        />

        <ProgramKineticSurface>
          <section className="marketing-page-section program-directory" data-reveal data-testid="program-directory-section">
            <div className="marketing-container">
              <div className="program-journey" aria-label="Support selection journey">
                <div className="program-journey__heading">
                  <span>Find your format</span>
                  <strong>Three steps to choose the right support.</strong>
                </div>
                <div className="program-journey__steps">
                  {journey.map((step) => (
                    <article key={step.number}>
                      <span>{step.number}</span>
                      <div><strong>{step.title}</strong><p>{step.copy}</p></div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="marketing-services-hierarchy">
                <section className="marketing-services-primary" data-testid="program-primary-services" aria-label="Core programs">
                  {primaryServices.map((service) => <ServiceCard service={service} index={services.indexOf(service)} variant="primary" key={service.id} />)}
                </section>
                {secondaryService ? (
                    <section className="marketing-services-secondary" data-testid="program-secondary-service" aria-label="Big Class overview">
                    <ServiceCard service={secondaryService} index={services.indexOf(secondaryService)} variant="secondary" />
                  </section>
                ) : null}
                <section className="marketing-services-supporting" data-testid="program-supporting-services" aria-label="Supporting services">
                  {supportingServices.map((service) => <ServiceCard service={service} index={services.indexOf(service)} variant="compact" key={service.id} />)}
                </section>
              </div>
            </div>
          </section>

          <section className="marketing-consultation-band program-consultation" data-program-band data-reveal data-testid="program-consultation-section">
            <div className="marketing-container">
              <div>
                <p className="marketing-kicker">Not sure where to start?</p>
                <h2>Tell us about your goal.</h2>
                <p className="program-consultation__copy">We can help map your needs before you choose a learning format.</p>
              </div>
              <a href={buildWhatsAppHref('Hello Strativate, I would like help choosing the right program.')} target="_blank" rel="noreferrer" data-testid="program-page-whatsapp-link">
                Chat via WhatsApp <ArrowRight aria-hidden="true" size={17} />
              </a>
            </div>
          </section>
        </ProgramKineticSurface>
      </main>
    </MarketingShell>
  )
}
