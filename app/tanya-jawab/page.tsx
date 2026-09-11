import { ArrowRight, CircleHelp } from 'lucide-react'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { faqPreview } from '@/lib/content/marketing-content'

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
        <section className="marketing-page-section">
          <div className="marketing-container marketing-faq-directory">
            <div className="marketing-faq-directory__aside"><CircleHelp aria-hidden="true" size={30} /><strong>Masih punya pertanyaan? Hubungi tim Strativate melalui kanal resmi yang tercantum di bagian bawah halaman.</strong></div>
            <div className="marketing-faq-list">
              {faqPreview.map((item, index) => (
                <details key={item.question} open={index === 0}>
                  <summary><span>0{index + 1}</span>{item.question}<ArrowRight aria-hidden="true" size={18} /></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
