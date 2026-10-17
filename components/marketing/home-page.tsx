import { ArrowRight, BadgeCheck, ChevronDown, Handshake, Heart, MessageCircle, Route, UsersRound, Zap } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { socialProof } from '@/lib/content/brand'
import { faqPreview, homepageExpertise, whyChooseStrativate } from '@/lib/content/marketing-content'
import type { MarketingTestimonialView } from '@/lib/marketing/testimonial-types'
import type { CompetitionRecognitionView } from '@/lib/marketing/competition-recognitions'
import type { TrustedPartnerView } from '@/lib/marketing/trusted-partners'
import type { HomepageWhoWeArePhotoView } from '@/lib/marketing/who-we-are-photos'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import type { PublicMentor } from '@/lib/mentor/public-profile-types'
import { mentoringProgramEditorial } from '@/lib/program-information'
import { cn } from '@/lib/utils'

import { DigitalProductCardSwap } from './digital-product-card-swap'
import { CompetitionRecognitionSection } from './competition-recognition-section'
import { HeroShapeGrid } from './hero-shape-grid'
import { MentorMarquee } from './mentor-marquee'
import { ProgramCard, type MarketingProgram } from './program-card'
import { TestimonialCircularGallery } from './testimonial-circular-gallery'
import { TrustedPartnersSection } from './trusted-partners-section'
import { WhoWeAreSection } from './who-we-are-section'
import { ExpertiseFloatingBackdrop } from './expertise-floating-backdrop'

const homepageExpertiseMarks = ['📝', '💼', '✍️', '🔬', '📣', '📊', '🎤', '🏛️'] as const
const whyChooseIcons = [Zap, UsersRound, BadgeCheck, Heart, Handshake, Route] as const

export function HomePage({
  mentors,
  testimonials,
  digitalProducts,
  digitalProductsEnabled,
  recognitions,
  trustedPartners,
  whoWeArePhotos,
}: {
  mentors: PublicMentor[]
  testimonials: MarketingTestimonialView[]
  digitalProducts: PublicDigitalProduct[]
  digitalProductsEnabled: boolean
  recognitions: CompetitionRecognitionView[]
  trustedPartners: TrustedPartnerView[]
  whoWeArePhotos: HomepageWhoWeArePhotoView[]
}) {
  const homePrograms: MarketingProgram[] = mentoringProgramEditorial.map((program) => ({
    id: program.slug,
    title: program.title,
    tagline: program.tagline,
    description: program.shortDescription,
    sessionRhythm: program.sessionRhythm,
    mentorSupport: program.mentorSupport,
    href: `/program/${program.slug}`,
    tone: program.tone,
  }))
  const whatsappHref = buildWhatsAppHref('Hello Strativate, I would like to learn more about your mentoring programs.')

  return (
    <main className="stakeholder-homepage">
      <section className="marketing-hero marketing-hero--revised homepage-hero" data-reveal data-testid="homepage-hero-section">
        <HeroShapeGrid />
        <div className="marketing-container homepage-hero__content">
          <div className="marketing-hero__copy homepage-hero__copy">
            <h1 className="marketing-hero__headline">Win Business Competitions with Expert Mentoring</h1>
            <p className="marketing-hero__lede">Transform your ideas into winning strategies. Get personalized guidance from experienced mentors and achieve podium finishes.</p>
            <div className="marketing-hero__actions">
              <a className={cn(buttonVariants({ variant: 'outline', size: 'marketing' }), 'homepage-hero__consultation')} href={whatsappHref} target="_blank" rel="noreferrer" data-testid="hero-whatsapp-link">Consultation <MessageCircle aria-hidden="true" size={17} /></a>
            </div>
          </div>
        </div>

        {testimonials.length ? (
          <div className="homepage-hero__gallery" data-testid="homepage-success-proof-section">
            <TestimonialCircularGallery items={testimonials} />
          </div>
        ) : null}

        <div className={cn('homepage-hero-cloud', testimonials.length > 0 && 'has-gallery')} data-testid="homepage-hero-cloud">
          <div className="homepage-hero-cloud__lobes" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
          </div>
          <div className="marketing-container homepage-hero-cloud__stats" aria-label="Strativate reach" data-testid="homepage-social-proof">
            {socialProof.map((proof) => <article key={proof.label}><strong>{proof.value}</strong><span>{proof.label}</span></article>)}
          </div>
        </div>
      </section>

      <CompetitionRecognitionSection recognitions={recognitions} />

      <WhoWeAreSection photos={whoWeArePhotos} />

      <section className="marketing-section stakeholder-section homepage-expertise" aria-labelledby="expertise-heading" data-reveal data-testid="homepage-expertise-section">
        <ExpertiseFloatingBackdrop />
        <div className="marketing-container homepage-expertise__inner">
          <div className="homepage-expertise__head">
            <p className="marketing-kicker">Our Expertise</p>
            <h2 id="expertise-heading">What We Specialize In</h2>
            <p>Explore the disciplines that turn a promising idea into a clear, persuasive competition submission.</p>
          </div>

          <div className="homepage-expertise__grid">
            {homepageExpertise.map((item, index) => {
              const expertiseMark = homepageExpertiseMarks[index]

              return (
                <article className="homepage-expertise__card" key={item.title}>
                  <div className="homepage-expertise__icon" aria-hidden="true">
                    <span className="homepage-expertise__mark">{expertiseMark}</span>
                  </div>
                  <span className="homepage-expertise__watermark" aria-hidden="true">{expertiseMark}</span>
                  <div className="homepage-expertise__card-copy">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* Programs and Digital Products share one homepage section: every way to prepare, side by side. */}
      <section className="marketing-section stakeholder-section homepage-programs" aria-labelledby="program-heading" data-reveal data-testid="homepage-programs-section">
        <div className="marketing-container homepage-programs__inner">
          <div className="homepage-programs__head">
            <h2 id="program-heading">Choose your path to Competition Success</h2>
            <div className="homepage-programs__method" role="img" aria-label="40% theory, 60% practice, 100% impact" data-testid="homepage-programs-method">
              <div className="homepage-programs__mix">
                <div className="homepage-programs__share is-theory"><strong>40%</strong><span>theory</span></div>
                <div className="homepage-programs__share is-practice"><strong>60%</strong><span>practice</span></div>
              </div>
              <div className="homepage-programs__impact"><strong>100%</strong><span>impact</span></div>
            </div>
          </div>

          <div className="marketing-program-grid homepage-programs__cards" data-testid="homepage-program-cards">
            {homePrograms.map((program) => <ProgramCard key={program.id} program={program} />)}
          </div>

          <div className="homepage-programs__footer">
            <Link className={cn(buttonVariants({ variant: 'primary', size: 'marketing' }), 'homepage-programs__view-all')} href="/program" data-testid="homepage-programs-view-all">
              View all programs <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>

          {digitalProductsEnabled ? (
            <section className="homepage-products homepage-programs__library" aria-labelledby="digital-products-heading" data-reveal data-testid="homepage-products-section">
              <div className="marketing-product-library__grid">
                <div className="marketing-product-library__copy">
                  <h3 id="digital-products-heading">Digital Products</h3>
                  <p className="marketing-product-library__lede">Learn beyond the session with ready-to-use guides, videos, and templates that help you prepare for business competitions.</p>
                  <Link className={cn(buttonVariants({ variant: 'primary', size: 'marketing' }), 'marketing-product-library__cta')} href="/digital-products" data-testid="homepage-products-cta">Explore digital products <ArrowRight aria-hidden="true" size={16} /></Link>
                </div>
                {digitalProducts.length ? <DigitalProductCardSwap products={digitalProducts} /> : <div className="stakeholder-empty-state"><strong>Digital products are coming soon.</strong><span>Product details will appear after final approval.</span></div>}
              </div>
            </section>
          ) : null}
        </div>
      </section>

      <section className="marketing-section stakeholder-section stakeholder-mentors" aria-labelledby="mentor-heading" data-reveal data-testid="homepage-mentors-section">
        <div className="marketing-container homepage-mentors__head">
          <h2 id="mentor-heading">Meet Our Mentors</h2>
          <Link className="marketing-text-link" href="/mentor">View all mentors <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
        <div className="homepage-mentors__rail">
          <MentorMarquee mentors={mentors} />
        </div>
      </section>

      <section className="marketing-section stakeholder-section homepage-why" aria-labelledby="why-choose-heading" data-reveal data-testid="homepage-why-choose-section">
        <div className="marketing-container homepage-why__inner">
          <div className="homepage-why__head">
            <p className="marketing-kicker">Why Us</p>
            <h2 id="why-choose-heading">Why Choose Strativate?</h2>
            <p>We’ve built the perfect ecosystem to turn ambitious students<br />{' '}into competition winners.</p>
          </div>

          <div className="homepage-why__grid">
            {whyChooseStrativate.map((item, index) => {
              const Icon = whyChooseIcons[index]

              return (
                <article className="homepage-why__card" key={item}>
                  <span className="homepage-why__icon" aria-hidden="true">
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <h3>{item}</h3>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <TrustedPartnersSection partners={trustedPartners} />

      <section className="marketing-section stakeholder-section homepage-faq" aria-labelledby="faq-heading" data-reveal data-testid="homepage-faq-section">
        <div className="marketing-container">
          <div className="homepage-faq__head">
            <h2 id="faq-heading">FAQ</h2>
            <Link className="marketing-text-link" href="/faq">See all questions <ArrowRight aria-hidden="true" size={16} /></Link>
          </div>
          <div className="homepage-faq__grid">
            {faqPreview.slice(0, 4).map((item) => (
              <details className="homepage-faq__item" key={item.question}>
                <summary><span>{item.question}</span><span className="homepage-faq__toggle" aria-hidden="true"><ChevronDown size={20} /></span></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
