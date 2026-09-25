import { ArrowDownRight, ArrowRight, CheckCircle2, CircleHelp, MessageCircle, Quote, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { socialProof } from '@/lib/content/brand'
import { bigClassPlaceholder, faqPreview, homepageExpertise, whyChooseStrativate } from '@/lib/content/marketing-content'
import type { MarketingHeroPosterView } from '@/lib/marketing/hero-posters'
import type { MarketingTestimonialView } from '@/lib/marketing/testimonial-types'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import type { PublicMentor } from '@/lib/mentor/public-profile-types'
import { mentoringProgramEditorial } from '@/lib/program-information'
import { cn } from '@/lib/utils'

import { DigitalProductCardSwap } from './digital-product-card-swap'
import { HeroCarousel } from './hero-carousel'
import { MentorMarquee } from './mentor-marquee'
import { ProgramCard, type MarketingProgram } from './program-card'
import { TestimonialCircularGallery } from './testimonial-circular-gallery'

export function HomePage({
  heroPosters,
  mentors,
  testimonials,
  digitalProducts,
  digitalProductsEnabled,
}: {
  heroPosters: MarketingHeroPosterView[]
  mentors: PublicMentor[]
  testimonials: MarketingTestimonialView[]
  digitalProducts: PublicDigitalProduct[]
  digitalProductsEnabled: boolean
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
      <section className="marketing-hero marketing-hero--revised" data-reveal data-testid="homepage-hero-section">
        <div className="marketing-container marketing-hero__grid">
          <div className="marketing-hero__copy">
            <p className="marketing-hero__eyebrow"><Sparkles aria-hidden="true" size={15} /> Expert mentoring for business competitions</p>
            <h1 className="marketing-hero__headline">Win Business Competitions with Expert Mentoring</h1>
            <p className="marketing-hero__lede">Transform your ideas into winning strategies. Get personalized guidance from experienced mentors and achieve podium finishes.</p>
            <div className="marketing-hero__actions">
              <Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program" data-testid="hero-program-link">Explore Programs <ArrowRight aria-hidden="true" size={17} /></Link>
              <a className={cn(buttonVariants({ variant: 'whatsapp', size: 'marketing' }), 'marketing-hero__whatsapp-action')} href={whatsappHref} target="_blank" rel="noreferrer" data-testid="hero-whatsapp-link">Chat on WhatsApp <MessageCircle aria-hidden="true" size={17} /></a>
            </div>
          </div>
          <div className="marketing-hero--revised__visual"><HeroCarousel posters={heroPosters} /></div>
        </div>
        <div className="marketing-container marketing-social-proof" aria-label="Strativate reach" data-testid="homepage-social-proof">
          <div className="marketing-hero__principles">{socialProof.map((proof) => <article key={proof.label}><span>{proof.value}</span><div><strong>{proof.label}</strong></div></article>)}</div>
        </div>
      </section>

      <section className="marketing-section stakeholder-section stakeholder-section--proof" aria-labelledby="success-proof-heading" data-reveal data-testid="homepage-success-proof-section">
        <div className="marketing-container">
          <div className="marketing-section-head is-wide"><div><p className="marketing-kicker">Success stories</p><h2 id="success-proof-heading">A clearer process.<br /><em>Stronger competition outcomes.</em></h2></div><p className="marketing-section-head__copy">See how focused preparation, feedback, and practical mentoring help participants move forward with confidence.</p></div>
          {testimonials.length ? <div className="stakeholder-proof-card"><Quote aria-hidden="true" size={28} /><div><p>{testimonials[0].testimonial}</p><strong>{testimonials[0].competition_name}</strong><span>{testimonials[0].achievement}</span></div></div> : <div className="stakeholder-empty-state"><strong>Participant stories are being prepared.</strong><span>Approved stories will appear here when their publication details are ready.</span></div>}
        </div>
      </section>

      <section className="marketing-section stakeholder-section stakeholder-section--who" aria-labelledby="who-we-are-heading" data-reveal data-testid="homepage-who-we-are-section">
        <div className="marketing-container stakeholder-split"><div><p className="marketing-kicker">Who We Are</p><h2 id="who-we-are-heading">Where Future-Ready Skills Meet Competition Success</h2></div><div><p>Strativate helps students build practical business skills, sharpen analytical thinking, and prepare for competitions with expert guidance.</p><Link className="marketing-text-link" href="/tentang-kami">Learn about Strativate <ArrowRight aria-hidden="true" size={16} /></Link></div></div>
      </section>

      <section className="marketing-section stakeholder-section" aria-labelledby="program-heading" data-reveal data-testid="homepage-programs-section">
        <div className="marketing-container">
          <div className="marketing-section-head is-wide"><div><p className="marketing-kicker">Our Programs</p><h2 id="program-heading">Choose the right program to build your skills and win competitions.</h2><p className="stakeholder-section__lede">Comprehensive mentoring and coaching services to help you win in business competitions and build future-ready skills.</p></div><div className="stakeholder-method"><strong>40% theory, 60% practice, 100% impact</strong><Link className="marketing-text-link" href="/program">View all programs <ArrowRight aria-hidden="true" size={16} /></Link></div></div>
          <div className="marketing-program-grid">{homePrograms.map((program) => <ProgramCard key={program.id} program={program} />)}</div>
          <div className="stakeholder-service-list" aria-label="Student services">{['Private Mentoring', 'Intensive Mentoring', 'Big Class', 'Consultation', 'Mock Competition', 'Proposal Review and Feedback', 'Workshop', 'Community'].map((service, index) => <span key={service}><b>0{index + 1}</b>{service}</span>)}</div>
        </div>
      </section>

      <section className="marketing-section stakeholder-section stakeholder-products marketing-product-library" aria-labelledby="digital-products-heading" data-reveal data-testid="homepage-products-section">
        <div className="marketing-container stakeholder-product-grid marketing-product-library__grid"><div className="marketing-product-library__copy"><p className="marketing-kicker">Digital Products</p><h2 id="digital-products-heading">Learn beyond the session.</h2><p className="stakeholder-section__lede">Ready-to-use guides, videos, and templates to help you prepare for business competitions.</p><Link className={cn(buttonVariants({ variant: 'primary', size: 'marketing' }), 'marketing-product-library__cta')} href="/produk-digital" data-testid="homepage-products-cta">Explore now <ArrowRight aria-hidden="true" size={16} /></Link></div>{digitalProductsEnabled && digitalProducts.length ? <DigitalProductCardSwap products={digitalProducts} /> : <div className="stakeholder-empty-state"><strong>Digital products are coming soon.</strong><span>Product details will appear after final approval.</span></div>}</div>
      </section>

      <section className="marketing-section stakeholder-section stakeholder-expertise" aria-labelledby="expertise-heading" data-reveal data-testid="homepage-expertise-section">
        <div className="marketing-container"><div className="marketing-section-head is-wide"><div><p className="marketing-kicker">What We Specialize In</p><h2 id="expertise-heading">Our Expertise</h2></div><p className="marketing-section-head__copy">Explore the disciplines that turn a promising idea into a clear, persuasive competition submission.</p></div><div className="stakeholder-expertise-grid">{homepageExpertise.map((item, index) => <article key={item.title}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></div>
      </section>

      <section className="marketing-section stakeholder-section stakeholder-mentors" aria-labelledby="mentor-heading" data-reveal data-testid="homepage-mentors-section">
        <div className="marketing-container"><div className="marketing-section-head is-wide"><div><p className="marketing-kicker">Meet Our Mentors</p><h2 id="mentor-heading">Learn from people who have<br /><em>been where you want to go.</em></h2></div><div className="marketing-section-head__note"><p>Learn from competition champions and industry professionals who have been where you want to go.</p><Link className="marketing-text-link" href="/mentor">Meet the mentors <ArrowRight aria-hidden="true" size={16} /></Link></div></div><MentorMarquee mentors={mentors} /></div>
      </section>

      <section className="marketing-section stakeholder-section stakeholder-why" aria-labelledby="why-choose-heading" data-reveal data-testid="homepage-why-choose-section">
        <div className="marketing-container"><div className="marketing-section-head"><div><p className="marketing-kicker">Why Choose Strativate</p><h2 id="why-choose-heading">A path that fits<br /><em>your ambition.</em></h2></div><p className="marketing-section-head__copy">A structured learning ecosystem designed to make high-level preparation feel accessible, practical, and personal.</p></div><div className="stakeholder-why-grid">{whyChooseStrativate.map((item) => <div key={item}><CheckCircle2 aria-hidden="true" size={20} /><span>{item}</span></div>)}</div></div>
      </section>

      {testimonials.length > 0 ? <section className="marketing-section marketing-testimonials stakeholder-section" aria-labelledby="testimonial-heading" data-reveal data-testid="homepage-testimonials-section"><div className="marketing-container"><div className="marketing-section-head"><div><p className="marketing-kicker">More success stories</p><h2 id="testimonial-heading">Real preparation.<br /><em>Real progress.</em></h2></div></div></div><TestimonialCircularGallery items={testimonials} /></section> : null}

      <section className="marketing-section marketing-faq-preview stakeholder-section" aria-labelledby="faq-heading" data-reveal data-testid="homepage-faq-section"><div className="marketing-container marketing-faq-preview__grid"><div><CircleHelp aria-hidden="true" size={26} /><p className="marketing-kicker">FAQ</p><h2 id="faq-heading">Start with the<br /><em>right questions.</em></h2><Link className={cn(buttonVariants({ variant: 'secondary', size: 'marketing' }), 'marketing-faq-preview__button')} href="/tanya-jawab">Read all FAQs <ArrowRight aria-hidden="true" size={16} /></Link></div><div className="marketing-faq-list">{faqPreview.slice(0, 3).map((item, index) => <details key={item.question} open={index === 0}><summary><span>0{index + 1}</span>{item.question}<ArrowDownRight aria-hidden="true" size={18} /></summary><p>{item.answer}</p></details>)}</div></div></section>
    </main>
  )
}
