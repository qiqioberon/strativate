import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { FaqDirectory } from '@/components/marketing/faq-directory'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'

export default function FaqPage() {
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Tanya jawab"
          title={<>Mulai dari informasi<br /><em>yang sudah pasti.</em></>}
          description="Temukan cara membandingkan layanan, memilih mentor, dan menghubungi tim Strativate."
          aside={<Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/program">Bandingkan program <ArrowRight data-icon="arrow" size={16} /></Link>}
        />
        <section className="marketing-page-section" data-reveal data-testid="faq-directory-section">
          <FaqDirectory />
        </section>
      </main>
    </MarketingShell>
  )
}
