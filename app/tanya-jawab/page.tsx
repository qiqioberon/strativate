import { MessageCircle } from 'lucide-react'

import { FaqDirectory } from '@/components/marketing/faq-directory'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'

export default function FaqPage() {
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Tanya jawab"
          title={<>Mulai dari informasi<br /><em>yang sudah pasti.</em></>}
          description="Temukan cara membandingkan layanan, memilih mentor, dan menghubungi tim Strativate."
          motif="faq"
          aside={<a className={buttonVariants({ variant: 'whatsapp', size: 'marketing' })} href={buildWhatsAppHref('Halo Strativate, saya masih memiliki pertanyaan tentang layanan Strativate. Bisa dibantu?')} target="_blank" rel="noreferrer" data-testid="faq-page-intro-whatsapp-link">Konsultasi WhatsApp <MessageCircle aria-hidden="true" size={17} /></a>}
        />
        <section className="marketing-page-section" data-reveal data-testid="faq-directory-section">
          <FaqDirectory />
        </section>
      </main>
    </MarketingShell>
  )
}
