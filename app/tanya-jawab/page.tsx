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
          eyebrow="FAQ"
          title={<>Start with information<br /><em>you can trust.</em></>}
          description="Find answers about comparing services, choosing a mentor, and contacting the Strativate team."
          motif="faq"
          aside={<a className={buttonVariants({ variant: 'whatsapp', size: 'marketing' })} href={buildWhatsAppHref('Hello Strativate, I have a question and would like some help.')} target="_blank" rel="noreferrer" data-testid="faq-page-intro-whatsapp-link">Chat on WhatsApp <MessageCircle aria-hidden="true" size={17} /></a>}
        />
        <section className="marketing-page-section" data-reveal data-testid="faq-directory-section">
          <FaqDirectory />
        </section>
      </main>
    </MarketingShell>
  )
}
