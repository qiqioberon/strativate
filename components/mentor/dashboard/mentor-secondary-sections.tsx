'use client'

import { ProfileForm } from '@/components/auth/profile-form'
import { DashboardNotificationCenter } from '@/components/dashboard/notification-center'
import { MentorAvailabilityEditor } from '@/components/mentor/availability-editor'
import { MentorPublicProfileForm } from '@/components/mentor/mentor-public-profile-form'
import type { MentorAvailabilityState, MentorDashboardData } from '@/lib/mentor/dashboard'
import type { MyMentorPublicProfileData } from '@/lib/mentor/public-profile-types'

import { availabilityLabel, availabilityTone, MentorPageHeader } from './dashboard-ui'
import type { MentorDashboardSection } from './mentor-overview'
import styles from './mentor-profile-layout.module.css'

export function AvailabilityPanel({ mentorId, onSaved, open }: { mentorId: string; onSaved: (value: MentorAvailabilityState) => void; open: (section: MentorDashboardSection) => void }) {
  return <div className="mentor-section"><MentorPageHeader eyebrow="Ketersediaan" title="Buka waktu terbaik Anda untuk sesi." detail="Ketersediaan menentukan slot yang boleh dipilih admin; perubahan tidak memindahkan booking yang sudah ada." action={<button type="button" className="button button-outline" onClick={() => open('calendar')}>Lihat kalender</button>}/><section className="role-card mentor-availability-card"><MentorAvailabilityEditor mentorId={mentorId} mode="mentor" onSaved={onSaved}/></section></div>
}

export function NotificationsPanel({ open }: { open: (section: MentorDashboardSection) => void }) {
  return <div className="mentor-section"><MentorPageHeader eyebrow="Notifikasi" title="Pembaruan operasional mentor." detail="Penugasan, jadwal, meeting link, reschedule, cancellation, dan scope update berasal dari backend notification yang sama dengan bell realtime." action={<button type="button" className="button button-primary" onClick={() => open('availability')}>Atur ketersediaan</button>}/><DashboardNotificationCenter onOpenRelated={item=>open(item.related_entity==='session'?'assignments':'overview')}/></div>
}

export function MentorProfilePanel({
  data,
  publicProfile,
  publicProfileError,
  open,
}: {
  data: MentorDashboardData
  publicProfile: MyMentorPublicProfileData
  publicProfileError: string | null
  open: (section: MentorDashboardSection) => void
}) {
  return (
    <div className="mentor-section">
      <MentorPageHeader
        eyebrow="Profil"
        title="Akun dan profil publik mentor."
        detail="Informasi akun tetap mengikuti policy profil. Informasi direktori publik dapat Anda kelola terpisah; tier, publikasi, dan status operasional tetap dikendalikan domain mentor/admin."
        action={<button type="button" className="button button-primary" onClick={() => open('availability')}>Atur ketersediaan</button>}
      />
      {data.metadataError ? <p className="mentor-inline-warning" role="status">{data.metadataError}</p> : null}
      <div className={styles.profileStack} data-testid="mentor-profile-management-stack">
        <ProfileForm />
        <MentorPublicProfileForm initialData={publicProfile} loadError={publicProfileError} />
        <section className="workspace-card mentor-operational-profile">
          <div>
            <p className="kicker">Operational Mentor Status</p>
            <h2>Status operasional</h2>
            <p>Informasi berikut read-only dan mengikuti konfigurasi domain mentor canonical.</p>
          </div>
          <dl>
            <div><dt>Tier mentor</dt><dd>{data.tierName || 'Belum ditetapkan'}</dd></div>
            <div><dt>Timezone</dt><dd>{data.timezone}</dd></div>
            <div><dt>Status akun mentor</dt><dd><span className={`ops-status ops-status--${data.isActive ? 'positive' : 'danger'}`}>{data.isActive ? 'Aktif' : 'Nonaktif'}</span></dd></div>
            <div><dt>Ketersediaan minggu ini</dt><dd><span className={`ops-status ops-status--${availabilityTone(data.availability.current)}`}>{availabilityLabel(data.availability.current)}</span></dd></div>
            <div><dt>Ketersediaan minggu depan</dt><dd><span className={`ops-status ops-status--${availabilityTone(data.availability.next)}`}>{availabilityLabel(data.availability.next)}</span></dd></div>
          </dl>
        </section>
      </div>
    </div>
  )
}
