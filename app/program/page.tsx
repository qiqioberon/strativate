import { ArrowRight, Building2, CheckCircle2, GraduationCap, MessageCircle, Trophy } from 'lucide-react'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { ProgramKineticSurface } from '@/components/marketing/program-kinetic'
import { ServiceCard } from '@/components/marketing/service-card'
import { buttonVariants } from '@/components/ui/button'
import { services } from '@/lib/content/services'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'

import './program-page.css'
import './program-layout-fix.css'

const intensiveFit = [
  'You want regular support from a dedicated mentor',
  'You’re preparing for a specific competition',
  'You want to improve your proposal, analysis, or pitch',
  'You’re looking for a clear plan and steady progress',
]

const organizationServices = [
  { title: 'Workshops', description: 'Interactive sessions that build skills in business planning, accounting, research, and presentation.', icon: GraduationCap },
  { title: 'Competition Mentoring & Judging', description: 'Mentors guide competition preparation while judges provide evaluation and feedback.', icon: Trophy },
  { title: 'Enrichment Programs', description: 'Structured learning with practical assignments and mock competitions to strengthen student skills.', icon: Building2 },
]

const programFaq = [
  ['Which mentoring format should I choose?', 'Choose Private Mentoring for flexible support around a specific goal, or Intensive Mentoring for structured, ongoing competition preparation.'],
  ['Can I join as an individual or a team?', 'Private Mentoring supports individuals and small teams. Share your needs with Strativate before choosing a package.'],
  ['Can Strativate review a proposal or presentation?', 'Yes. Proposal Review & Feedback and Mock Competition services are designed for focused review, practice, and mentor feedback.'],
  ['Can schools and organizations work with Strativate?', 'Yes. Strativate provides workshops, competition mentoring and judging, and enrichment programs for schools and organizations.'],
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
          aside={<a className={buttonVariants({ variant: 'whatsapp', size: 'marketing' })} href={buildWhatsAppHref('Hello Strativate, I would like help choosing the right Strativate program.')} target="_blank" rel="noreferrer" data-testid="program-page-intro-whatsapp-link">Consultation Now <MessageCircle aria-hidden="true" size={17} /></a>}
        />

        <ProgramKineticSurface>
          <section className="marketing-page-section program-directory" data-reveal data-testid="program-directory-section">
            <div className="marketing-container">
              <div className="program-section-heading program-overview-heading"><p className="marketing-kicker">Our services for Students</p><h2>Programs designed for individual students and small teams preparing for business competitions.</h2></div>
              <div className="marketing-services-hierarchy">
                <section className="marketing-services-primary" data-testid="program-primary-services" aria-label="Core programs">
                  {primaryServices.map(service => <ServiceCard service={service} index={services.indexOf(service)} variant="primary" key={service.id} />)}
                </section>
                {secondaryService ? <section className="marketing-services-secondary" data-testid="program-secondary-service" aria-label="Big Class overview"><ServiceCard service={secondaryService} index={services.indexOf(secondaryService)} variant="secondary" /></section> : null}
                <section className="marketing-services-supporting" data-testid="program-supporting-services" aria-label="Supporting services">
                  {supportingServices.map(service => <ServiceCard service={service} index={services.indexOf(service)} variant="compact" key={service.id} />)}
                </section>
              </div>
            </div>
          </section>

          <section className="marketing-section program-paths" data-reveal data-testid="program-mentoring-path-section">
            <div className="marketing-container">
              <div className="marketing-section-head is-wide"><div><p className="marketing-kicker">Choose Your Mentoring Path</p><h2>Personalized guidance, in the format that fits your goal.</h2></div><p className="marketing-section-head__copy">Both options provide personalized guidance. Choose the format that fits your goals and preparation needs.</p></div>
              <div className="program-path-grid">
                <article><span>01</span><h3>Private Mentoring</h3><p>Focused support for a specific goal. Book flexible sessions to learn competition fundamentals, improve a deliverable, or get feedback on a particular challenge.</p><Link href="/program/private-mentoring">Start Your Learning Journey <ArrowRight aria-hidden="true" size={16} /></Link></article>
                <article><span>02</span><h3>Intensive Mentoring</h3><p>Structured, ongoing guidance to help you prepare for competitions and build practical skills.</p><Link href="/program/intensive-mentoring">Explore Intensive Mentoring <ArrowRight aria-hidden="true" size={16} /></Link></article>
              </div>
            </div>
          </section>

          <section className="marketing-section program-fit" data-reveal data-testid="program-perfect-fit-section">
            <div className="marketing-container program-fit__grid"><div><p className="marketing-kicker">Intensive Mentoring</p><h2>Perfect for you if</h2><p>Choose ongoing support when you want a clearer preparation rhythm and steady feedback.</p></div><div className="program-fit__list">{intensiveFit.map(item => <div key={item}><CheckCircle2 aria-hidden="true" size={20} /><span>{item}</span></div>)}</div></div>
          </section>

          <section className="marketing-section program-organizations" data-reveal data-testid="program-organizations-section">
            <div className="marketing-container"><div className="marketing-section-head is-wide"><div><p className="marketing-kicker">Schools & Organizations</p><h2>Our Services for Schools & Organizations</h2></div><p className="marketing-section-head__copy">Comprehensive programs that help students build business skills and prepare for competitions.</p></div><div className="program-organization-grid">{organizationServices.map(({ title, description, icon: Icon }) => <article key={title}><Icon aria-hidden="true" size={24} /><h3>{title}</h3><p>{description}</p></article>)}</div></div>
          </section>

          <section className="marketing-section program-faq" data-reveal data-testid="program-faq-section">
            <div className="marketing-container"><div className="marketing-section-head"><div><p className="marketing-kicker">FAQ</p><h2>Questions before you start?</h2></div></div><div className="program-faq__list">{programFaq.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}</summary><p>{answer}</p></details>)}</div></div>
          </section>

          <section className="marketing-consultation-band program-consultation" data-reveal data-testid="program-final-cta-section">
            <div className="marketing-container"><div><p className="marketing-kicker">Ready Start Your Journey</p><h2>Get personalized guidance from our experienced mentors</h2></div><a href={buildWhatsAppHref('Hello Strativate, I would like help choosing the right program.')} target="_blank" rel="noreferrer" data-testid="program-page-whatsapp-link">Contact us <ArrowRight aria-hidden="true" size={17} /></a></div>
          </section>
        </ProgramKineticSurface>
      </main>
    </MarketingShell>
  )
}
