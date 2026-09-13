import { ArrowRight, MessageCircle } from 'lucide-react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { ServiceCard } from '@/components/marketing/service-card'
import { buttonVariants } from '@/components/ui/button'
import { listPublicCatalog } from '@/lib/catalog/public'
import { connectServicesToCatalog } from '@/lib/content/services'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'

export default async function ProgramPage() {
  const services = connectServicesToCatalog(await listPublicCatalog())
  const primaryServices = services.filter(service => service.id === 'private-mentoring' || service.id === 'intensive-mentoring')
  const secondaryService = services.find(service => service.id === 'big-class')
  const supportingServices = services.filter(service => !primaryServices.includes(service) && service !== secondaryService)
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Program Strativate"
          title={<>Pilih dukungan yang<br /><em>sesuai tahapmu.</em></>}
          description="Delapan layanan Strativate mendukung kebutuhan belajar, konsultasi, dan persiapan kompetisi. Detail komersial hanya ditampilkan untuk program yang telah tersedia di Product Master."
          motif="program"
          aside={<a className={buttonVariants({ variant: 'whatsapp', size: 'marketing' })} href={buildWhatsAppHref('Halo Strativate, saya ingin konsultasi untuk memilih program Strativate yang sesuai.')} target="_blank" rel="noreferrer" data-testid="program-page-intro-whatsapp-link">Konsultasi WhatsApp <MessageCircle aria-hidden="true" size={17} /></a>}
        />
        <section className="marketing-page-section" data-reveal data-testid="program-directory-section">
          <div className="marketing-container marketing-services-hierarchy">
            <div className="marketing-services-primary" data-testid="program-primary-services" aria-label="Program utama">
              {primaryServices.map((service) => <ServiceCard service={service} index={services.indexOf(service)} variant="primary" key={service.id} />)}
            </div>
            {secondaryService ? <div className="marketing-services-secondary" data-testid="program-secondary-service" aria-label="Gambaran Big Class">
              <ServiceCard service={secondaryService} index={services.indexOf(secondaryService)} variant="secondary" />
            </div> : null}
            <div className="marketing-services-supporting" data-testid="program-supporting-services" aria-label="Layanan pendukung">
              {supportingServices.map((service) => <ServiceCard service={service} index={services.indexOf(service)} variant="compact" key={service.id} />)}
            </div>
          </div>
        </section>
        <section className="marketing-consultation-band" data-reveal data-testid="program-consultation-section">
          <div className="marketing-container"><div><p className="marketing-kicker">Belum yakin memilih?</p><h2>Ceritakan target dan tahap persiapanmu.</h2></div><a href={buildWhatsAppHref('Halo Strativate, saya ingin dibantu memilih program yang sesuai.')} target="_blank" rel="noreferrer" data-testid="program-page-whatsapp-link">Konsultasi via WhatsApp <ArrowRight aria-hidden="true" size={17} /></a></div>
        </section>
      </main>
    </MarketingShell>
  )
}
