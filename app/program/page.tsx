import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { ServiceCard } from '@/components/marketing/service-card'
import { buttonVariants } from '@/components/ui/button'
import { listPublicCatalog } from '@/lib/catalog/public'
import { connectServicesToCatalog } from '@/lib/content/services'

export default async function ProgramPage() {
  const services = connectServicesToCatalog(await listPublicCatalog())
  const primaryProgram = services.find(service => service.productType === 'private_mentoring' && service.href)
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Program Strativate"
          title={<>Pilih dukungan yang<br /><em>sesuai tahapmu.</em></>}
          description="Delapan layanan Strativate mendukung kebutuhan belajar, konsultasi, dan persiapan kompetisi. Detail komersial hanya ditampilkan untuk program yang telah tersedia di Product Master."
          aside={primaryProgram ? <Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href={primaryProgram.href!}>{primaryProgram.detailLabel} <ArrowRight data-icon="arrow" size={16} /></Link> : undefined}
        />
        <section className="marketing-page-section">
          <div className="marketing-container marketing-services-grid">
            {services.map((service, index) => <ServiceCard service={service} index={index} key={service.id} />)}
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
