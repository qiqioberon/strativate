import { ArrowRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { MentorCard } from '@/components/marketing/mentor-card'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { mentorPlaceholders } from '@/lib/content/marketing-content'

export default function MentorPage() {
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Direktori mentor"
          title={<>Kenali mentormu<br /><em>melalui data yang jelas.</em></>}
          description="Nama, foto, institusi, pencapaian, dan penilaian hanya akan ditampilkan setelah sumber serta izin publikasinya terverifikasi."
          aside={<Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program">Pilih program dahulu <ArrowRight data-icon="arrow" size={16} /></Link>}
        />
        <section className="marketing-page-section">
          <div className="marketing-container">
            <div className="marketing-content-notice"><ShieldCheck aria-hidden="true" size={20} /><div><strong>Direktori sedang dipersiapkan</strong><p>Komponen ini sudah mendukung seluruh atribut opsional tanpa menjadikannya klaim wajib.</p></div></div>
            <div className="marketing-mentor-grid marketing-mentor-grid--directory">
              {mentorPlaceholders.map((mentor, index) => <MentorCard mentor={mentor} index={index} key={mentor.id} />)}
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
