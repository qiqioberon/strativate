import { ArrowRight, Building2, CalendarDays, CheckCircle2, GraduationCap, MessageCircle, Route, Target, Trophy, UsersRound } from 'lucide-react'
import Link from 'next/link'

import { MentoringPathShapeGrid } from '@/components/marketing/hero-shape-grid'
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
          title="Our Programs"
          description="Comprehensive mentoring and coaching services to help you win in business competitions and build future-ready skills."
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

          <section className="marketing-section program-paths" aria-labelledby="mentoring-path-heading" data-reveal data-testid="program-mentoring-path-section">
            <MentoringPathShapeGrid />
            <div className="marketing-container">
              <div className="program-paths__head">
                <h2 id="mentoring-path-heading">Choose Your Mentoring Path</h2>
                <p>Personalized guidance, in the format that fits your goal. Get focused support for your next challenge or build momentum with structured, ongoing preparation.</p>
              </div>
              <div className="program-path-grid">
                <article className="program-path-card program-path-card--private" aria-labelledby="private-path-heading">
                  <div className="program-path-card__header">
                    <div className="program-path-card__icon" aria-hidden="true"><Target size={28} strokeWidth={1.7} /></div>
                    <h3 id="private-path-heading">Private Mentoring</h3>
                    <p>Focused guidance for your next step.</p>
                  </div>
                  <div className="program-path-card__body">
                    <p className="program-path-card__description">Learn competition fundamentals, sharpen a deliverable, or work through a specific challenge with flexible, targeted support—not a long structured program.</p>
                    <dl className="program-path-card__details">
                      <div><dt><CalendarDays aria-hidden="true" size={17} />Session rhythm</dt><dd>A flexible number of sessions based on your current needs.</dd></div>
                      <div><dt><UsersRound aria-hidden="true" size={17} />Mentor support</dt><dd>Matched to your topic and mentor availability.</dd></div>
                    </dl>
                    <div className="program-path-card__benefits">
                      <h4>Support where you need it</h4>
                      <ul>
                        <li><CheckCircle2 aria-hidden="true" size={18} /><span>Direct consultation and targeted, actionable feedback</span></li>
                        <li><CheckCircle2 aria-hidden="true" size={18} /><span>Proposal or deck review and specific analysis</span></li>
                        <li><CheckCircle2 aria-hidden="true" size={18} /><span>Pitching practice or a short, focused consultation</span></li>
                      </ul>
                    </div>
                    <div className="program-path-card__fit"><h4>Ideal for</h4><p>A specific topic, a single deliverable, or an immediate challenge.</p></div>
                    <Link className={buttonVariants({ variant: 'primary', size: 'marketing', className: 'program-path-card__cta' })} href="/program/private-mentoring">Explore Private Mentoring <ArrowRight aria-hidden="true" size={17} data-icon="arrow" /></Link>
                  </div>
                </article>
                <article className="program-path-card program-path-card--intensive" aria-labelledby="intensive-path-heading">
                  <div className="program-path-card__header">
                    <div className="program-path-card__icon" aria-hidden="true"><Route size={28} strokeWidth={1.7} /></div>
                    <h3 id="intensive-path-heading">Intensive Mentoring</h3>
                    <p>A clear structure. Continuous progress.</p>
                  </div>
                  <div className="program-path-card__body">
                    <p className="program-path-card__description">Prepare for competitions and build practical skills through connected stages, with structured, ongoing guidance from one consistent mentor throughout your program.</p>
                    <dl className="program-path-card__details">
                      <div><dt><CalendarDays aria-hidden="true" size={17} />Session rhythm</dt><dd>Regular or weekly mentoring, with multiple sessions per month tailored to your support needs.</dd></div>
                      <div><dt><UsersRound aria-hidden="true" size={17} />Mentor support</dt><dd>One dedicated mentor for continuity throughout your preparation.</dd></div>
                    </dl>
                    <div className="program-path-card__benefits">
                      <h4>Build momentum at every stage</h4>
                      <ul>
                        <li><CheckCircle2 aria-hidden="true" size={18} /><span>End-to-end guidance across connected preparation stages</span></li>
                        <li><CheckCircle2 aria-hidden="true" size={18} /><span>Regular review and feedback across multiple deliverables</span></li>
                        <li><CheckCircle2 aria-hidden="true" size={18} /><span>Progress monitoring and long-term skill development</span></li>
                      </ul>
                    </div>
                    <div className="program-path-card__fit"><h4>Ideal for</h4><p>Full competition preparation, multiple deliverables, and sustained skill development.</p></div>
                    <Link className={buttonVariants({ variant: 'primary', size: 'marketing', className: 'program-path-card__cta' })} href="/program/intensive-mentoring">Explore Intensive Mentoring <ArrowRight aria-hidden="true" size={17} data-icon="arrow" /></Link>
                  </div>
                </article>
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
