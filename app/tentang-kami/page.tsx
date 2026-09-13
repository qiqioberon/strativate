import { ArrowRight, Focus, Repeat2, Waypoints } from 'lucide-react'
import Link from 'next/link'

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
          eyebrow="Tentang Strativate"
          title={<>Ambisi bertemu<br /><em>persiapan yang terarah.</em></>}
          description="Strativate adalah platform akselerasi untuk mengembangkan keterampilan masa depan melalui pelatihan bisnis, akuntansi, dan persiapan kompetisi dengan pendekatan praktis."
          aside={<Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program">Temukan program <ArrowRight data-icon="arrow" size={16} /></Link>}
        />
        <section className="marketing-page-section marketing-about-page" data-reveal data-testid="about-story-section">
          <div className="marketing-container marketing-about-page__statement">
            <span>STRATIVATE / APPROACH</span>
            <h2>Pelatihan dirancang untuk membantu peserta membangun keterampilan praktis dan <em>bergerak lebih siap menghadapi kompetisi.</em></h2>
          </div>
          <div className="marketing-container marketing-about-page__principles">
            {preparationPrinciples.map((principle, index) => {
              const Icon = icons[index]
              return <article key={principle.number}><Icon aria-hidden="true" size={22} /><span>{principle.number}</span><h3>{principle.title}</h3><p>{principle.description}</p></article>
            })}
          </div>
        </section>
        <section className="marketing-consultation-band marketing-consultation-band--dark" data-reveal data-testid="about-consultation-section"><div className="marketing-container"><div><p className="marketing-kicker">Mulai percakapan</p><h2>Persiapan yang tepat dimulai dari kebutuhanmu.</h2></div><a href={buildWhatsAppHref('Halo Strativate, saya ingin mengetahui pendekatan dan layanan Strativate lebih lanjut.')} target="_blank" rel="noreferrer" data-testid="about-whatsapp-link">Hubungi Strativate <ArrowRight aria-hidden="true" size={17} /></a></div></section>
      </main>
    </MarketingShell>
  )
}
