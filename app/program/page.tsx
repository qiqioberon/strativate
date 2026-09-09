import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { ProgramCard, type MarketingProgram } from '@/components/marketing/program-card'
import { buttonVariants } from '@/components/ui/button'
import { bigClassPlaceholder } from '@/lib/content/marketing-content'
import { mentoringPrograms } from '@/lib/program-information'

const programs: MarketingProgram[] = [
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

export default function ProgramPage() {
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Program Strativate"
          title={<>Pilih dukungan yang<br /><em>sesuai tahapmu.</em></>}
          description="Bandingkan program dengan informasi yang sudah disetujui. Detail yang belum memiliki master produksi ditandai secara terbuka."
          aside={<Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program/private-mentoring">Lihat Mentoring Privat <ArrowRight data-icon="arrow" size={16} /></Link>}
        />
        <section className="marketing-page-section">
          <div className="marketing-container marketing-program-grid">
            {programs.map((program) => <ProgramCard program={program} key={program.number} />)}
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
