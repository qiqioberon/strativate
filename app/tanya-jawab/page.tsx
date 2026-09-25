import { Mail, MessageCircle } from 'lucide-react'

import { FaqDirectory } from '@/components/marketing/faq-directory'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { publicContact } from '@/lib/content/brand'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'

export default function FaqPage() {
  return (
    <MarketingShell>
      <main className="faq-reference-page">
        <header className="faq-reference-hero" data-testid="faq-reference-hero"><div className="marketing-container"><p className="marketing-kicker">FAQ</p><h1>Have Questions?<br /><em>We Have Answers.</em></h1><p>Find clear information about Strativate programs, mentoring, competition preparation, and support.</p></div></header>
        <section className="marketing-section" data-reveal data-testid="faq-directory-section"><div className="marketing-container"><div className="marketing-section-head"><div><p className="marketing-kicker">FAQ</p><h2>Curious about Strativate?</h2></div></div><FaqDirectory /></div></section>
        <section className="faq-reference-contact" data-testid="faq-contact-section"><div className="marketing-container"><div><p className="marketing-kicker">Can’t find what you’re looking for?</p><h2>Ask the Strativate team.</h2></div><div className="faq-reference-contact__actions"><a href={buildWhatsAppHref('Hello Strativate, I have a question and would like some help.')} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" size={18} /> WhatsApp</a><a href={publicContact.emailHref}><Mail aria-hidden="true" size={18} /> {publicContact.email}</a></div></div></section>
      </main>
    </MarketingShell>
  )
}
