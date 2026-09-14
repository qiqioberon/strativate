import { ArrowRight, MessageCircle } from 'lucide-react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { ProgramKineticSurface } from '@/components/marketing/program-kinetic'
import { ServiceCard } from '@/components/marketing/service-card'
import { buttonVariants } from '@/components/ui/button'
import { listPublicCatalog } from '@/lib/catalog/public'
import { connectServicesToCatalog } from '@/lib/content/services'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'

import './program-page.css'

const journey = [
  { number: '01', title: 'Pilih kebutuhan', copy: 'Mulai dari target, tantangan, dan ritme persiapanmu.' },
  { number: '02', title: 'Kenali format', copy: 'Bandingkan pendampingan personal, intensif, kelas, atau review.' },
  { number: '03', title: 'Mulai persiapan', copy: 'Masuk ke program yang paling relevan dan bergerak lebih terarah.' },
]

export default async function ProgramPage() {
  const services = connectServicesToCatalog(await listPublicCatalog())
  const primaryServices = services.filter(service => service.id === 'private-mentoring' || service.id === 'intensive-mentoring')
  const secondaryService = services.find(service => service.id === 'big-class')
  const supportingServices = services.filter(service => !primaryServices.includes(service) && service !== secondaryService)

  return (
    <MarketingShell>
      <main className="program-page">
        <PageIntro
          eyebrow="Program Strativate"
          title={<>Pilih dukungan yang<br /><em>sesuai tahapmu.</em></>}
          description="Delapan layanan Strativate mendukung kebutuhan belajar, konsultasi, dan persiapan kompetisi. Detail komersial hanya ditampilkan untuk program yang telah tersedia di Product Master."
          motif="program"
          aside={(
            <div className="program-intro-panel">
              <div className="program-intro-facts" aria-label="Ringkasan layanan Strativate">
                <span><strong>08</strong> layanan</span>
                <span><strong>02</strong> program utama</span>
                <span><strong>01</strong> tujuan: lebih terarah</span>
              </div>
              <a className={buttonVariants({ variant: 'whatsapp', size: 'marketing' })} href={buildWhatsAppHref('Halo Strativate, saya ingin konsultasi untuk memilih program Strativate yang sesuai.')} target="_blank" rel="noreferrer" data-testid="program-page-intro-whatsapp-link">
                Konsultasi WhatsApp <MessageCircle aria-hidden="true" size={17} />
              </a>
            </div>
          )}
        />

        <ProgramKineticSurface>
          <section className="marketing-page-section program-directory" data-reveal data-testid="program-directory-section">
            <div className="marketing-container">
              <div className="program-journey" aria-label="Alur memilih dukungan">
                <div className="program-journey__heading">
                  <span>Mulai dari kebutuhanmu</span>
                  <strong>Tiga langkah untuk menemukan format yang pas.</strong>
                </div>
                <div className="program-journey__steps">
                  {journey.map((step) => (
                    <article key={step.number}>
                      <span>{step.number}</span>
                      <div><strong>{step.title}</strong><p>{step.copy}</p></div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="marketing-services-hierarchy">
                <section className="marketing-services-primary" data-testid="program-primary-services" aria-label="Program utama">
                  {primaryServices.map((service) => <ServiceCard service={service} index={services.indexOf(service)} variant="primary" key={service.id} />)}
                </section>
                {secondaryService ? (
                  <section className="marketing-services-secondary" data-testid="program-secondary-service" aria-label="Gambaran Big Class">
                    <ServiceCard service={secondaryService} index={services.indexOf(secondaryService)} variant="secondary" />
                  </section>
                ) : null}
                <section className="marketing-services-supporting" data-testid="program-supporting-services" aria-label="Layanan pendukung">
                  {supportingServices.map((service) => <ServiceCard service={service} index={services.indexOf(service)} variant="compact" key={service.id} />)}
                </section>
              </div>
            </div>
          </section>

          <section className="marketing-consultation-band program-consultation" data-program-band data-reveal data-testid="program-consultation-section">
            <div className="marketing-container">
              <div>
                <p className="marketing-kicker">Belum yakin memilih?</p>
                <h2>Ceritakan target dan tahap persiapanmu.</h2>
                <p className="program-consultation__copy">Kami bantu memetakan kebutuhanmu sebelum kamu menentukan format belajar.</p>
              </div>
              <a href={buildWhatsAppHref('Halo Strativate, saya ingin dibantu memilih program yang sesuai.')} target="_blank" rel="noreferrer" data-testid="program-page-whatsapp-link">
                Konsultasi via WhatsApp <ArrowRight aria-hidden="true" size={17} />
              </a>
            </div>
          </section>
        </ProgramKineticSurface>
      </main>
    </MarketingShell>
  )
}
