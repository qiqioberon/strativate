import { MessageCircle } from 'lucide-react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { MentorDirectory } from '@/components/marketing/mentor-directory'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { mentors } from '@/lib/content/mentors'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'

export default function MentorPage() {
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Direktori mentor"
          title={<>Belajar bersama mentor<br /><em>yang berpengalaman.</em></>}
          description="Temukan mentor berdasarkan kategori dan keahlian yang tercantum dalam data mentor Strativate. Profil tanpa foto menggunakan penanda yang jelas."
          motif="mentor"
          aside={<a className={buttonVariants({ variant: 'whatsapp', size: 'marketing' })} href={buildWhatsAppHref('Halo Strativate, saya ingin konsultasi untuk memilih mentor yang sesuai dengan kebutuhan saya.')} target="_blank" rel="noreferrer" data-testid="mentor-page-intro-whatsapp-link">Konsultasi WhatsApp <MessageCircle aria-hidden="true" size={17} /></a>}
        />
        <section className="marketing-page-section" data-reveal data-testid="mentor-directory-section">
          <div className="marketing-container">
            <MentorDirectory mentors={mentors} />
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
