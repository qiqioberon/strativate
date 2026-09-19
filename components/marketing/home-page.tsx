import {
  ArrowDownRight,
  ArrowRight,
  BookOpenCheck,
  CircleHelp,
  MessageCircle,
  MoveRight,
  Quote,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

import { TextType } from '@/components/animations/react-bits-text'
import { OnboardingShapeGrid } from '@/components/onboarding/shape-grid-background'
import { buttonVariants } from '@/components/ui/button'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { socialProof } from '@/lib/content/brand'
import {
  bigClassPlaceholder,
  faqPreview,
} from '@/lib/content/marketing-content'
import type { MarketingHeroPosterView } from '@/lib/marketing/hero-posters'
import type { MarketingTestimonialView } from '@/lib/marketing/testimonial-types'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import type { PublicMentor } from '@/lib/mentor/public-profile-types'
import { mentoringProgramEditorial } from '@/lib/program-information'
import { cn } from '@/lib/utils'

import { DigitalProductCardSwap } from './digital-product-card-swap'
import { HeroCarousel } from './hero-carousel'
import { HeroKineticSurface, HeroVisualStage, MagneticAction } from './hero-kinetic'
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
  const whatsappHref = buildWhatsAppHref('Halo Strativate, saya ingin konsultasi untuk menentukan program yang paling sesuai dengan kebutuhan saya.')

  return (
    <main>
      <section className="marketing-hero" data-reveal data-testid="homepage-hero-section">
        <HeroKineticSurface>
          <OnboardingShapeGrid className="marketing-hero-shape-grid" testId="hero-shape-grid" />
          <div className="marketing-container marketing-hero__grid">
            <div className="marketing-hero__copy">
              <p className="marketing-hero__eyebrow"><Sparkles aria-hidden="true" size={15} /> Persiapan kompetisi, lebih terarah</p>
              <h1
                className="marketing-hero__headline"
                aria-label="Strategi yang kuat dimulai dari cara berpikir yang tajam."
              >
                <span className="marketing-hero__headline-line">Strategi yang kuat dimulai dari</span>
                <em className="marketing-hero__headline-line marketing-hero__headline-line--accent" data-testid="hero-text-type">
                  <TextType
                    text={[
                      'cara berpikir yang tajam.',
                      'analisis yang terarah.',
                      'keputusan yang matang.',
                      'ide yang meyakinkan.',
                    ]}
                  />
                </em>
              </h1>
              <p className="marketing-hero__lede">Bimbingan personal dan program persiapan yang membantumu mengurai tantangan, berlatih dengan fokus, dan bergerak dengan arah yang lebih jelas.</p>
              <div className="marketing-hero__actions">
                <MagneticAction className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program" testId="hero-program-link">
                  Temukan programmu <ArrowRight data-icon="arrow" aria-hidden="true" size={17} />
                </MagneticAction>
                <MagneticAction className={cn(buttonVariants({ variant: 'secondary', size: 'marketing' }), 'marketing-hero__mentor-action')} href="/mentor" testId="hero-mentor-link">
                  Kenali mentor <MoveRight data-icon="arrow" aria-hidden="true" size={17} />
                </MagneticAction>
                <MagneticAction
                  className={cn(buttonVariants({ variant: 'whatsapp', size: 'marketing' }), 'marketing-hero__whatsapp-action')}
                  href={whatsappHref}
                  testId="hero-whatsapp-link"
                  external
                >
                  Konsultasi WhatsApp <MessageCircle aria-hidden="true" size={17} />
                </MagneticAction>
              </div>
            </div>

            <HeroVisualStage><HeroCarousel posters={heroPosters} /></HeroVisualStage>
          </div>
          <div className="marketing-container marketing-social-proof" data-testid="homepage-social-proof">
            <p className="marketing-proof-context">Siswa kami berasal dari</p>
            <div className="marketing-hero__principles" aria-label="Jangkauan peserta Strativate">
              {socialProof.map((proof) => (
                <article key={proof.label}>
                  <span>{proof.value}</span>
                  <div><strong>{proof.label}</strong></div>
                </article>
              ))}
            </div>
          </div>
        </HeroKineticSurface>
      </section>

      <section className="marketing-section marketing-programs" aria-labelledby="program-heading" data-reveal data-testid="homepage-programs-section">
        <div className="marketing-container">
          <div className="marketing-section-head is-wide">
            <div>
              <p className="marketing-kicker">Pilih bekal unggulmu</p>
              <h2 id="program-heading">Pilih cara belajarmu.<br /><em>Dengan ritme yang kamu pilih.</em></h2>
            </div>
            <Link className="marketing-text-link" href="/program" data-testid="all-programs-link">Lihat semua program <ArrowRight data-icon="arrow" size={16} /></Link>
          </div>
          <div className="marketing-program-grid">
            {homePrograms.map((program) => <ProgramCard key={program.id} program={program} />)}
          </div>
        </div>
      </section>

      <section className="marketing-statement" data-reveal data-testid="homepage-approach-section">
        <div className="marketing-container marketing-statement__grid">
          <Quote aria-hidden="true" size={34} />
          <div>
            <p className="marketing-kicker">Cara kerja kami</p>
            <h2>Persiapan yang baik bukan tentang terlihat paling siap. <em>Ia membuat langkah berikutnya terasa jelas.</em></h2>
          </div>
          <Link className={buttonVariants({ variant: 'dark', size: 'marketing' })} href="/tentang-kami" data-testid="approach-about-link">
            Tentang pendekatan kami <ArrowRight data-icon="arrow" size={16} />
          </Link>
        </div>
      </section>

      <section className="marketing-section marketing-mentors" aria-labelledby="mentor-heading" data-reveal data-testid="homepage-mentors-section">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <div>
              <p className="marketing-kicker">Mentor Strativate</p>
              <h2 id="mentor-heading">Belajar dari pengalaman,<br /><em>bertumbuh dengan arahan.</em></h2>
            </div>
            <div className="marketing-section-head__note">
              <p>Kenali pengalaman, pencapaian, dan fokus keahlian mentor yang tercantum dalam data Strativate.</p>
              <Link className="marketing-text-link" href="/mentor" data-testid="mentor-directory-link">Buka direktori mentor <ArrowRight data-icon="arrow" size={16} /></Link>
            </div>
          </div>
          <MentorMarquee mentors={mentors} />
        </div>
      </section>

      {testimonials.length > 0 ? (
        <section
          className="marketing-section marketing-testimonials"
          aria-labelledby="testimonial-heading"
          data-reveal
          data-testid="homepage-testimonials-section"
        >
          <div className="marketing-container">
            <div className="marketing-section-head marketing-testimonials__heading">
              <div>
                <p className="marketing-kicker">Cerita dari peserta</p>
                <h2 id="testimonial-heading">
                  Dari proses yang lebih terarah,
                  <br />
                  <em>lahir hasil yang mereka banggakan.</em>
                </h2>
              </div>
              <div className="marketing-section-head__note">
                <p>Jelajahi perjalanan peserta Strativate dan lihat bagaimana proses mentoring membantu mereka mempertajam strategi sebelum kompetisi.</p>
              </div>
            </div>
          </div>
          <TestimonialCircularGallery items={testimonials} />
        </section>
      ) : null}

      {digitalProductsEnabled ? (
        <section
          className="marketing-section marketing-product-library"
          aria-labelledby="digital-products-heading"
          data-reveal
          data-testid="homepage-products-section"
        >
          <div className="marketing-container marketing-product-library__grid">
            <div className="marketing-product-library__copy">
              <p className="marketing-kicker">Koleksi digital Strativate</p>
              <h2 id="digital-products-heading">
                Belajar tak harus berhenti di sesi.
                <br />
                <em>Bawa materinya, lanjutkan ritmemu.</em>
              </h2>
              <p className="marketing-product-library__lede">
                Jelajahi Produk Digital yang tersedia dan pilih materi yang paling relevan untuk mendukung proses belajarmu.
              </p>
              <Link
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'marketing' }),
                  'marketing-product-library__cta',
                )}
                href="/produk-digital"
                data-testid="homepage-products-cta"
              >
                Jelajahi Produk Digital
                <ArrowRight data-icon="arrow" aria-hidden="true" size={16} />
              </Link>
            </div>
            <div className="marketing-product-library__showcase">
              <DigitalProductCardSwap products={digitalProducts} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="marketing-section marketing-about-preview" aria-labelledby="about-heading" data-reveal data-testid="homepage-about-section">
        <div className="marketing-container marketing-about-preview__grid">
          <div className="marketing-about-preview__title">
            <BookOpenCheck aria-hidden="true" size={28} />
            <p className="marketing-kicker">Mengapa Strativate</p>
            <h2 id="about-heading">Ambisi yang besar tetap membutuhkan <em>proses yang manusiawi.</em></h2>
          </div>
          <div className="marketing-about-preview__copy">
            <p>Kami merancang ruang belajar untuk membantu peserta menyusun prioritas, menguji pemikiran, dan memperbaiki hasil kerja secara bertahap.</p>
            <Link className="marketing-text-link" href="/tentang-kami" data-testid="about-preview-link">Baca tentang Strativate <ArrowRight data-icon="arrow" size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-faq-preview" aria-labelledby="faq-heading" data-reveal data-testid="homepage-faq-section">
        <div className="marketing-container marketing-faq-preview__grid">
          <div>
            <CircleHelp aria-hidden="true" size={26} />
            <p className="marketing-kicker">Tanya jawab</p>
            <h2 id="faq-heading">Mulai dengan<br /><em>pertanyaan yang tepat.</em></h2>
            <Link className={cn(buttonVariants({ variant: 'secondary', size: 'marketing' }), 'marketing-faq-preview__button')} href="/tanya-jawab" data-testid="faq-preview-link">
              Buka semua jawaban <ArrowRight data-icon="arrow" size={16} />
            </Link>
          </div>
          <div className="marketing-faq-list">
            {faqPreview.slice(0, 3).map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary><span>0{index + 1}</span>{item.question}<ArrowDownRight aria-hidden="true" size={18} /></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
