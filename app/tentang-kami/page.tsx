import { ArrowRight, Focus, Repeat2, Waypoints } from 'lucide-react'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { preparationPrinciples } from '@/lib/content/marketing-content'

const icons = [Focus, Waypoints, Repeat2]

export default function AboutPage() {
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Tentang Strativate"
          title={<>Ambisi bertemu<br /><em>persiapan yang terarah.</em></>}
          description="Strativate hadir sebagai ruang persiapan kompetisi: membantu peserta menyusun langkah, menguji pemikiran, dan berkembang melalui proses yang jelas."
          aside={<Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program">Temukan program <ArrowRight data-icon="arrow" size={16} /></Link>}
        />
        <section className="marketing-page-section marketing-about-page">
          <div className="marketing-container marketing-about-page__statement">
            <span>STRATIVATE / APPROACH</span>
            <h2>Kepercayaan diri tidak harus dimulai dari semua jawaban. Ia bisa dimulai dari <em>satu langkah yang dipahami.</em></h2>
          </div>
          <div className="marketing-container marketing-about-page__principles">
            {preparationPrinciples.map((principle, index) => {
              const Icon = icons[index]
              return <article key={principle.number}><Icon aria-hidden="true" size={22} /><span>{principle.number}</span><h3>{principle.title}</h3><p>{principle.description}</p></article>
            })}
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
