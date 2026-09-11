import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { MentorDirectory } from '@/components/marketing/mentor-directory'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { mentors } from '@/lib/content/mentors'

export default function MentorPage() {
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Direktori mentor"
          title={<>Belajar bersama mentor<br /><em>yang berpengalaman.</em></>}
          description="Temukan mentor berdasarkan kategori dan keahlian yang tercantum dalam data mentor Strativate. Profil tanpa foto menggunakan penanda yang jelas."
          aside={<Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program">Pilih program dahulu <ArrowRight data-icon="arrow" size={16} /></Link>}
        />
        <section className="marketing-page-section">
          <div className="marketing-container">
            <MentorDirectory mentors={mentors} />
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
