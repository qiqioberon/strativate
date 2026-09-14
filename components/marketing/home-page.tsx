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

import { buttonVariants } from '@/components/ui/button'
import { bigClassPlaceholder, faqPreview } from '@/lib/content/marketing-content'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { socialProof } from '@/lib/content/brand'
import { mentors } from '@/lib/content/mentors'
import type { MarketingHeroPosterView } from '@/lib/marketing/hero-posters'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import { programEditorial } from '@/lib/program-information'
import type { PrivateMentoringPublicView } from '@/lib/private-mentoring/types'
import { cn } from '@/lib/utils'

import { DigitalProductCarousel } from './digital-product-carousel'
import { HeroCarousel } from './hero-carousel'
import { HeroKineticSurface, HeroVisualStage, MagneticAction } from './hero-kinetic'
import { MentorMarquee } from './mentor-marquee'
import { ProgramCard, type MarketingProgram } from './program-card'

export function HomePage({
  heroPosters,
  digitalProducts,
  digitalProductsEnabled,
  privateMentoring,
}: {
  heroPosters: MarketingHeroPosterView[]
  digitalProducts: PublicDigitalProduct[]
  digitalProductsEnabled: boolean
  privateMentoring: PrivateMentoringPublicView | null
}) {
  const homePrograms: MarketingProgram[] = []
  if (privateMentoring) {
    homePrograms.push({
      id: privateMentoring.slug,
      number: '01',
      title: privateMentoring.title,
      kicker: privateMentoring.kicker,
      description: privateMentoring.shortDescription,
      highlights: privateMentoring.highlights.map(item => item.text),
      href: '/program/private-mentoring',
      assetKey: 'programs.private.cover',
      status: 'information',
      tone: 'orange',
    })
  }
  const intensive = programEditorial['intensive-mentoring']
  homePrograms.push({
    id: intensive.slug,
    number: String(homePrograms.length + 1).padStart(2, '0'),
    title: intensive.title,
    kicker: intensive.kicker,
    description: intensive.shortDescription,
    highlights: intensive.highlights,
    href: `/program/${intensive.slug}`,
    assetKey: intensive.assetKey,
    status: 'information',
    tone: intensive.tone,
  })
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
          <div className="marketing-container marketing-hero__grid">
            <div className="marketing-hero__copy">
              <p className="marketing-hero__eyebrow"><Sparkles aria-hidden="true" size={15} /> Persiapan kompetisi, lebih terarah</p>
              <h1 className="marketing-hero__headline">
                <span className="marketing-hero__headline-line">Bangun cara berpikir.</span>
                <em className="marketing-hero__headline-line marketing-hero__headline-line--accent">Temukan langkahmu.</em>
              </h1>
              <p className="marketing-hero__lede">Bimbingan personal dan program persiapan yang membantumu mengurai tantangan, berlatih dengan fokus, dan bergerak dengan arah yang lebih jelas.</p>
              <div className="marketing-hero__actions">
                <MagneticAction className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program" testId="hero-program-link">
                  Temukan programmu <ArrowRight data-icon="arrow" aria-hidden="true" size={17} />
                </MagneticAction>
                <MagneticAction className={cn(buttonVariants({ variant: 'secondary', size: 'marketing' }), 'marketing-hero__mentor-action')} href="/mentor" testId="hero-mentor-link">
                  Kenali mentor <MoveRight data-icon="arrow" aria-hidden="true" size={17} />
                </MagneticAction>
                <MagneticAction className={cn(buttonVariants({ variant: 'whatsapp', size: 'marketing' }), 'marketing-hero__whatsapp-action')} href={whatsappHref} testId="hero-whatsapp-link" external>
                  Konsultasi WhatsApp <MessageCircle aria-hidden="true" size={17} />
                </MagneticAction>
              </div>
            </div>
            <HeroVisualStage><HeroCarousel posters={heroPosters} /></HeroVisualStage>
          </div>
          <div className="marketing-container marketing-social-proof" data-testid="homepage-social-proof">
            <p className="marketing-proof-context">Siswa kami berasal dari</p>
            <div className="marketing-hero__principles" aria-label="Jangkauan peserta Strativate">
              {socialProof.map((proof) => <article key={proof.label}><span>{proof.value}</span><div><strong>{proof.label}</strong></div></article>)}
            </div>
          </div>
        </HeroKineticSurface>
      </section>

      <section className="marketing-section marketing-programs" aria-labelledby="program-heading" data-reveal data-testid="homepage-programs-section">
        <div className="marketing-container">
          <div className="marketing-section-head is-wide">
            <div><p className="marketing-kicker">Pilih bekal unggulmu</p><h2 id="program-heading">Pilih cara belajarmu.<br /><em>Dengan ritme yang kamu pilih.</em></h2></div>
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
          <div><p className="marketing-kicker">Cara kerja kami</p><h2>Persiapan yang baik bukan tentang terlihat paling siap. <em>Ia membuat langkah berikutnya terasa jelas.</em></h2></div>
          <Link className={buttonVariants({ variant: 'dark', size: 'marketing' })} href="/tentang-kami" data-testid="approach-about-link">Tentang pendekatan kami <ArrowRight data-icon="arrow" size={16} /></Link>
        </div>
      </section>

      <section className="marketing-section marketing-mentors" aria-labelledby="mentor-heading" data-reveal data-testid="homepage-mentors-section">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <div><p className="marketing-kicker">Mentor Strativate</p><h2 id="mentor-heading">Belajar dari pengalaman,<br /><em>bertumbuh dengan arahan.</em></h2></div>
            <div className="marketing-section-head__note"><p>Kenali pengalaman, pencapaian, dan fokus keahlian mentor yang tercantum dalam data Strativate.</p><Link className="marketing-text-link" href="/mentor" data-testid="mentor-directory-link">Buka direktori mentor <ArrowRight data-icon="arrow" size={16} /></Link></div>
          </div>
          <MentorMarquee mentors={mentors} />
        </div>
      </section>

      {digitalProductsEnabled ? (
        <section className="marketing-section marketing-product-library" data-reveal data-testid="homepage-products-section">
          <div className="marketing-container">
            <DigitalProductCarousel products={digitalProducts} />
          </div>
        </section>
      ) : null}

      <section className="marketing-section marketing-about-preview" aria-labelledby="about-heading" data-reveal data-testid="homepage-about-section">
        <div className="marketing-container marketing-about-preview__grid">
          <div className="marketing-about-preview__title"><BookOpenCheck aria-hidden="true" size={28} /><p className="marketing-kicker">Mengapa Strativate</p><h2 id="about-heading">Ambisi yang besar tetap membutuhkan <em>proses yang manusiawi.</em></h2></div>
          <div className="marketing-about-preview__copy"><p>Kami merancang ruang belajar untuk membantu peserta menyusun prioritas, menguji pemikiran, dan memperbaiki hasil kerja secara bertahap.</p><Link className="marketing-text-link" href="/tentang-kami" data-testid="about-preview-link">Baca tentang Strativate <ArrowRight data-icon="arrow" size={16} /></Link></div>
        </div>
      </section>

      <section className="marketing-section marketing-faq-preview" aria-labelledby="faq-heading" data-reveal data-testid="homepage-faq-section">
        <div className="marketing-container marketing-faq-preview__grid">
          <div><CircleHelp aria-hidden="true" size={26} /><p className="marketing-kicker">Tanya jawab</p><h2 id="faq-heading">Mulai dengan<br /><em>pertanyaan yang tepat.</em></h2><Link className={cn(buttonVariants({ variant: 'secondary', size: 'marketing' }), 'marketing-faq-preview__button')} href="/tanya-jawab" data-testid="faq-preview-link">Buka semua jawaban <ArrowRight data-icon="arrow" size={16} /></Link></div>
          <div className="marketing-faq-list">{faqPreview.slice(0, 3).map((item, index) => <details key={item.question} open={index === 0}><summary><span>0{index + 1}</span>{item.question}<ArrowDownRight aria-hidden="true" size={18} /></summary><p>{item.answer}</p></details>)}</div>
        </div>
      </section>
    </main>
  )
}
