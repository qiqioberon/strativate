import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { ProgramCard, type MarketingProgram } from '@/components/marketing/program-card'
import { buttonVariants } from '@/components/ui/button'
import { listPublicCatalog } from '@/lib/catalog/public'
import { selectProgramDirectory, toMarketingProgram } from '@/lib/catalog/presentation'
import { bigClassPlaceholder } from '@/lib/content/marketing-content'

export default async function ProgramPage() {
  const catalogProducts = await listPublicCatalog()
  const programs: MarketingProgram[] = selectProgramDirectory(catalogProducts).map(toMarketingProgram)
  const hasPublishedBigClass = catalogProducts.some(product => product.productType === 'big_class')
  if (!hasPublishedBigClass) {
    programs.push({
      id: 'big-class-placeholder',
      number: String(programs.length + 1).padStart(2, '0'),
      title: bigClassPlaceholder.title,
      kicker: bigClassPlaceholder.kicker,
      description: bigClassPlaceholder.description,
      highlights: [],
      assetKey: bigClassPlaceholder.cover,
      status: 'placeholder',
      tone: 'yellow',
    })
  }
  const primaryProgram = programs.find(program => program.status === 'approved')

  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Program Strativate"
          title={<>Pilih dukungan yang<br /><em>sesuai tahapmu.</em></>}
          description="Bandingkan program dengan informasi yang sudah disetujui. Detail yang belum memiliki master produksi ditandai secara terbuka."
          aside={<Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href={primaryProgram?.href ?? '/explore'}>{primaryProgram ? `Lihat ${primaryProgram.title}` : 'Lihat katalog'} <ArrowRight data-icon="arrow" size={16} /></Link>}
        />
        <section className="marketing-page-section">
          <div className="marketing-container marketing-program-grid">
            {programs.map((program) => <ProgramCard program={program} key={program.id} />)}
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
