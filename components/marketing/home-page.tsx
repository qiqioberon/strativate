import {
  ArrowDownRight,
  ArrowRight,
  BookOpenCheck,
  CircleHelp,
  Compass,
  MoveRight,
  Quote,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { mentoringPrograms } from '@/lib/program-information'
import {
  bigClassPlaceholder,
  faqPreview,
  mentorPlaceholders,
  preparationPrinciples,
  productPlaceholders,
} from '@/lib/content/marketing-content'
import { cn } from '@/lib/utils'

import { AssetMedia } from './asset-media'
import { MentorCard } from './mentor-card'
import { ProgramCard, type MarketingProgram } from './program-card'

const homePrograms: MarketingProgram[] = [
  ...mentoringPrograms.map((program, index) => ({
    number: `0${index + 1}`,
    title: program.title,
    kicker: program.kicker,
    description: program.description,
    highlights: program.highlights,
    priceLabel: program.priceLabel,
    priceContext: program.priceContext,
    href: `/program/${program.slug}`,
    assetKey: `programs.${index === 0 ? 'private' : 'intensive'}.cover` as const,
    status: 'approved' as const,
    tone: index === 0 ? 'orange' as const : 'red' as const,
  })),
  {
    number: '03',
    title: bigClassPlaceholder.title,
    kicker: bigClassPlaceholder.kicker,
    description: bigClassPlaceholder.description,
    highlights: [],
    assetKey: bigClassPlaceholder.cover,
    status: 'placeholder',
    tone: 'yellow',
  },
]

export function HomePage() {
  return (
    <main>
      <section className="marketing-hero">
        <div className="marketing-container marketing-hero__grid">
          <div className="marketing-hero__copy">
            <p className="marketing-hero__eyebrow"><Sparkles aria-hidden="true" size={15} /> Persiapan kompetisi, lebih terarah</p>
            <h1>Bangun cara berpikir.<br /><em>Temukan langkahmu.</em></h1>
            <p className="marketing-hero__lede">Bimbingan personal dan program persiapan yang membantumu mengurai tantangan, berlatih dengan fokus, dan bergerak dengan arah yang lebih jelas.</p>
            <div className="marketing-hero__actions">
              <Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program">
                Temukan programmu <ArrowRight data-icon="arrow" aria-hidden="true" size={17} />
              </Link>
              <Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/mentor">
                Kenali mentor <MoveRight data-icon="arrow" aria-hidden="true" size={17} />
              </Link>
            </div>
          </div>

          <div className="marketing-hero__visual" aria-label="Slot visual utama Strativate">
            <div className="marketing-hero__visual-head">
              <span>STRATIVATE / 01</span>
              <Compass aria-hidden="true" size={22} />
            </div>
            <AssetMedia assetKey="achievements.featured.image" priority sizes="(max-width: 900px) 94vw, 47vw" />
            <div className="marketing-hero__visual-foot">
              <strong>Ruang untuk<br />bertumbuh.</strong>
              <p>Siap diganti dengan key visual atau dokumentasi resmi tanpa mengubah komposisi hero.</p>
              <ArrowDownRight aria-hidden="true" size={28} />
            </div>
          </div>
        </div>
        <div className="marketing-container marketing-hero__principles" aria-label="Cara persiapan Strativate">
          {preparationPrinciples.map((principle) => (
            <article key={principle.number}>
              <span>{principle.number}</span>
              <div><strong>{principle.title}</strong><p>{principle.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-programs" aria-labelledby="program-heading">
        <div className="marketing-container">
          <div className="marketing-section-head is-wide">
            <div>
              <p className="marketing-kicker">Pilih bekal unggulmu</p>
              <h2 id="program-heading">Pilih cara belajarmu.<br /><em>Dengan ritme yang kamu pilih.</em></h2>
            </div>
            <Link className="marketing-text-link" href="/program">Lihat semua program <ArrowRight data-icon="arrow" size={16} /></Link>
          </div>
          <div className="marketing-program-grid">
            {homePrograms.map((program) => <ProgramCard key={program.number} program={program} />)}
          </div>
        </div>
      </section>

      <section className="marketing-statement">
        <div className="marketing-container marketing-statement__grid">
          <Quote aria-hidden="true" size={34} />
          <div>
            <p className="marketing-kicker">Cara kerja kami</p>
            <h2>Persiapan yang baik bukan tentang terlihat paling siap. <em>Ia membuat langkah berikutnya terasa jelas.</em></h2>
          </div>
          <Link className={buttonVariants({ variant: 'dark', size: 'marketing' })} href="/tentang-kami">
            Tentang pendekatan kami <ArrowRight data-icon="arrow" size={16} />
          </Link>
        </div>
      </section>

      <section className="marketing-section marketing-mentors" aria-labelledby="mentor-heading">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <div>
              <p className="marketing-kicker">Profil yang akan terverifikasi</p>
              <h2 id="mentor-heading">Mentor yang tepat,<br /><em>tanpa tebakan.</em></h2>
            </div>
            <div className="marketing-section-head__note">
              <p>Struktur profil sudah siap untuk foto dan data resmi. Identitas baru tampil setelah verifikasi dan izin publikasi.</p>
              <Link className="marketing-text-link" href="/mentor">Buka direktori mentor <ArrowRight data-icon="arrow" size={16} /></Link>
            </div>
          </div>
          <div className="marketing-mentor-grid">
            {mentorPlaceholders.map((mentor, index) => <MentorCard mentor={mentor} index={index} key={mentor.id} />)}
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-products" aria-labelledby="product-heading">
        <div className="marketing-container marketing-products__grid">
          <div className="marketing-products__intro">
            <p className="marketing-kicker">Produk digital</p>
            <h2 id="product-heading">Materi yang siap<br /><em>mengikuti ritmemu.</em></h2>
            <p>Sampul, nama, format, dan harga final belum dipublikasikan. Slot ini sudah disiapkan agar katalog dapat diperbarui langsung dari data dan registry aset.</p>
            <Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/produk-digital">
              Lihat ruang produk <ArrowRight data-icon="arrow" size={16} />
            </Link>
          </div>
          <div className="marketing-product-stack">
            {productPlaceholders.map((product, index) => (
              <article className="marketing-product-card" key={product.id}>
                <AssetMedia assetKey={product.cover} decorative sizes="(max-width: 760px) 32vw, 13vw" />
                <div>
                  <span>{product.eyebrow}</span>
                  <h3>{product.title}</h3>
                  <p>{product.description}</p>
                </div>
                <strong aria-hidden="true">0{index + 1}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-about-preview" aria-labelledby="about-heading">
        <div className="marketing-container marketing-about-preview__grid">
          <div className="marketing-about-preview__title">
            <BookOpenCheck aria-hidden="true" size={28} />
            <p className="marketing-kicker">Mengapa Strativate</p>
            <h2 id="about-heading">Ambisi yang besar tetap membutuhkan <em>proses yang manusiawi.</em></h2>
          </div>
          <div className="marketing-about-preview__copy">
            <p>Kami merancang ruang belajar untuk membantu peserta menyusun prioritas, menguji pemikiran, dan memperbaiki hasil kerja secara bertahap.</p>
            <Link className="marketing-text-link" href="/tentang-kami">Baca tentang Strativate <ArrowRight data-icon="arrow" size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-faq-preview" aria-labelledby="faq-heading">
        <div className="marketing-container marketing-faq-preview__grid">
          <div>
            <CircleHelp aria-hidden="true" size={26} />
            <p className="marketing-kicker">Tanya jawab</p>
            <h2 id="faq-heading">Mulai dengan<br /><em>pertanyaan yang tepat.</em></h2>
            <Link className={cn(buttonVariants({ variant: 'secondary', size: 'marketing' }), 'marketing-faq-preview__button')} href="/tanya-jawab">
              Buka semua jawaban <ArrowRight data-icon="arrow" size={16} />
            </Link>
          </div>
          <div className="marketing-faq-list">
            {faqPreview.map((item, index) => (
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
