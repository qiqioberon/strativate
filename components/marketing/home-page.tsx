import { ArrowDownRight, ArrowRight, BookOpenText, CheckCircle2, CircleHelp, MessageCircle, Settings2, Trophy } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { socialProof } from '@/lib/content/brand'
import { bigClassPlaceholder, faqPreview, homepageExpertise, whyChooseStrativate } from '@/lib/content/marketing-content'
import type { MarketingTestimonialView } from '@/lib/marketing/testimonial-types'
import type { CompetitionRecognitionView } from '@/lib/marketing/competition-recognitions'
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
import { WhoWeAreSection } from './who-we-are-section'

const homepageExpertiseMarks = ['📝', '💼', '✍️', '🔬', '📣', '📊', '🎤', '🏛️'] as const

export function HomePage({
  mentors,
  testimonials,
  digitalProducts,
  digitalProductsEnabled,
  recognitions,
  whoWeArePhotos,
}: {
  mentors: PublicMentor[]
  testimonials: MarketingTestimonialView[]
  digitalProducts: PublicDigitalProduct[]
  digitalProductsEnabled: boolean
  recognitions: CompetitionRecognitionView[]
  whoWeArePhotos: HomepageWhoWeArePhotoView[]
}) {
  const homePrograms: MarketingProgram[] = mentoringProgramEditorial.map((program, index) => ({
    id: program.slug,
    number: String(index + 1).padStart(2, '0'),
    title: program.title,
    kicker: program.kicker,
    description: program.shortDescription,
    highlights: program.highlights,
    href: `/program/${program.slug}`,
    assetKey: program.assetKey,
    status: 'information',
    tone: program.tone,
  }))
  homePrograms.push({
    id: 'big-class-placeholder',
    number: String(homePrograms.length + 1).padStart(2, '0'),
    title: bigClassPlaceholder.title,
    kicker: bigClassPlaceholder.kicker,
    description: bigClassPlaceholder.description,
    highlights: [],
    assetKey: bigClassPlaceholder.cover,
    status: 'overview',
    tone: 'yellow',
  })
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

      <section className="marketing-section stakeholder-section homepage-programs" aria-labelledby="program-heading" data-reveal data-testid="homepage-programs-section">
        <div className="marketing-container homepage-programs__inner">
          <div className="marketing-section-head is-wide homepage-programs__head">
            <div className="homepage-programs__copy">
              <p className="marketing-kicker">Our Programs</p>
              <h2 id="program-heading">Choose the right program to build your skills and win competitions</h2>
              <p className="stakeholder-section__lede">Comprehensive mentoring and coaching services to help you win in business competitions and build future-ready skills.</p>
            </div>
            <div className="homepage-programs__method" aria-label="40% theory, 60% practice, 100% impact" data-testid="homepage-programs-method">
              <div className="homepage-programs__stat is-theory"><BookOpenText aria-hidden="true" size={22} /><strong>40%</strong><span>theory</span></div>
              <div className="homepage-programs__stat is-practice"><Settings2 aria-hidden="true" size={22} /><strong>60%</strong><span>practice</span></div>
              <div className="homepage-programs__stat is-impact"><Trophy aria-hidden="true" size={22} /><strong>100%</strong><span>impact</span></div>
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
        </div>
      </section>

      <section className="marketing-section stakeholder-section stakeholder-products marketing-product-library" aria-labelledby="digital-products-heading" data-reveal data-testid="homepage-products-section">
        <div className="marketing-container stakeholder-product-grid marketing-product-library__grid"><div className="marketing-product-library__copy"><p className="marketing-kicker">Digital Products</p><h2 id="digital-products-heading">Learn beyond the session</h2><p className="stakeholder-section__lede">Ready-to-use guides, videos, and templates to help you prepare for business competitions.</p><Link className={cn(buttonVariants({ variant: 'primary', size: 'marketing' }), 'marketing-product-library__cta')} href="/produk-digital" data-testid="homepage-products-cta">Explore now <ArrowRight aria-hidden="true" size={16} /></Link></div>{digitalProductsEnabled && digitalProducts.length ? <DigitalProductCardSwap products={digitalProducts} /> : <div className="stakeholder-empty-state"><strong>Digital products are coming soon.</strong><span>Product details will appear after final approval.</span></div>}</div>
      </section>

      <section className="marketing-section stakeholder-section homepage-expertise" aria-labelledby="expertise-heading" data-reveal data-testid="homepage-expertise-section">
        <div className="marketing-container homepage-expertise__inner">
          <div className="homepage-expertise__head">
            <p className="marketing-kicker">What We Specialize In</p>
            <h2 id="expertise-heading">Our Expertise</h2>
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

      <section className="marketing-section stakeholder-section stakeholder-mentors" aria-labelledby="mentor-heading" data-reveal data-testid="homepage-mentors-section">
        <div className="marketing-container"><div className="marketing-section-head is-wide"><div><p className="marketing-kicker">Meet Our Mentors</p><h2 id="mentor-heading">Learn from people who have<br />{' '}been where you want to go</h2></div><div className="marketing-section-head__note"><p>Learn from competition champions and industry professionals who have been where you want to go.</p><Link className="marketing-text-link" href="/mentor">Meet the mentors <ArrowRight aria-hidden="true" size={16} /></Link></div></div><MentorMarquee mentors={mentors} /></div>
      </section>

      <section className="marketing-section stakeholder-section stakeholder-why" aria-labelledby="why-choose-heading" data-reveal data-testid="homepage-why-choose-section">
        <div className="marketing-container"><div className="marketing-section-head"><div><p className="marketing-kicker">Why Choose Strativate</p><h2 id="why-choose-heading">A path that fits<br />{' '}your ambition</h2></div><p className="marketing-section-head__copy">A structured learning ecosystem designed to make high-level preparation feel accessible, practical, and personal.</p></div><div className="stakeholder-why-grid">{whyChooseStrativate.map((item) => <div key={item}><CheckCircle2 aria-hidden="true" size={20} /><span>{item}</span></div>)}</div></div>
      </section>

      <section className="marketing-section marketing-faq-preview stakeholder-section" aria-labelledby="faq-heading" data-reveal data-testid="homepage-faq-section"><div className="marketing-container marketing-faq-preview__grid"><div><CircleHelp aria-hidden="true" size={26} /><p className="marketing-kicker">FAQ</p><h2 id="faq-heading">Start with the<br />{' '}right questions</h2><Link className={cn(buttonVariants({ variant: 'secondary', size: 'marketing' }), 'marketing-faq-preview__button')} href="/tanya-jawab">Read all FAQs <ArrowRight aria-hidden="true" size={16} /></Link></div><div className="marketing-faq-list">{faqPreview.slice(0, 3).map((item, index) => <details key={item.question} open={index === 0}><summary><span>0{index + 1}</span>{item.question}<ArrowDownRight aria-hidden="true" size={18} /></summary><p>{item.answer}</p></details>)}</div></div></section>
    </main>
  )
}
