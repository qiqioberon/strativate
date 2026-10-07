'use client'

import { Award, CalendarCheck2, CalendarDays, Globe2, UserRoundCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { ProfileForm } from '@/components/auth/profile-form'
import { DashboardNotificationCenter } from '@/components/dashboard/notification-center'
import { MentorAvailabilityEditor } from '@/components/mentor/availability-editor'
import { MentorPublicProfileForm } from '@/components/mentor/mentor-public-profile-form'
import type { MentorAvailabilityState, MentorDashboardData } from '@/lib/mentor/dashboard'
import type { MyMentorPublicProfileData } from '@/lib/mentor/public-profile-types'
import type { Notification } from '@/lib/supabase/database.types'

import type { MentorDashboardSection } from './mentor-overview'
import profileStyles from './mentor-profile-layout.module.css'
import styles from './mentor-secondary-sections.module.css'

function PageHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className={styles.pageHeading}>
      <h1>{title}</h1>
      {action ? <div className={styles.pageHeadingAction}>{action}</div> : null}
    </div>
  )
}

function availabilityLabel(value: boolean | null) {
  if (value === null) return 'Not verified'
  return value ? 'Set' : 'Not set'
}

function availabilityToneClass(value: boolean | null) {
  if (value === null) return styles.neutral
  return value ? styles.positive : styles.warning
}

export function AvailabilityPanel({ mentorId, onSaved, open }: { mentorId: string; onSaved: (value: MentorAvailabilityState) => void; open: (section: MentorDashboardSection) => void }) {
  return (
    <div className={`mentor-section ${styles.section}`}>
      <PageHeading
        title="Availability"
        action={(
          <button type="button" className={`button button-outline ${styles.headerAction}`} onClick={() => open('calendar')}>
            <CalendarDays aria-hidden="true" />
            View calendar
          </button>
        )}
      />
      <section className={`role-card mentor-availability-card ${styles.availabilityCard}`}>
        <MentorAvailabilityEditor mentorId={mentorId} mode="mentor" onSaved={onSaved} />
      </section>
    </div>
  )
}

export function NotificationsPanel({ open: fallbackOpen, onOpenRelated }: { open: (section: MentorDashboardSection) => void; onOpenRelated?: (item: Notification) => void }) {
  return (
    <div className={`mentor-section ${styles.section}`}>
      <PageHeading title="Notifications" />
      <DashboardNotificationCenter
        language="en"
        onOpenRelated={onOpenRelated ?? (item => fallbackOpen(item.related_entity === 'session' ? 'assignments' : 'overview'))}
      />
    </div>
  )
}

export function MentorProfilePanel({
  data,
  publicProfile,
  publicProfileError,
}: {
  data: MentorDashboardData
  publicProfile: MyMentorPublicProfileData
  publicProfileError: string | null
  open: (section: MentorDashboardSection) => void
}) {
  return (
    <div className={`mentor-section ${styles.section}`}>
      <PageHeading title="Profile" />
      {data.metadataError ? <p className={styles.inlineWarning} role="status">Some operational profile details could not be loaded.</p> : null}
      <div className={profileStyles.profileStack} data-testid="mentor-profile-management-stack">
        <ProfileForm language="en" />
        <MentorPublicProfileForm initialData={publicProfile} loadError={publicProfileError} />
        <section className={`workspace-card mentor-operational-profile ${styles.operationalCard}`}>
          <div className={styles.cardHeading}>
            <h2>Operational status</h2>
          </div>
          <dl className={styles.statusGrid}>
            <div className={styles.statusTile}>
              <span className={styles.statusIcon}><Award aria-hidden="true" /></span>
              <dt>Mentor tier</dt>
              <dd>{data.tierName || 'Tier not assigned'}</dd>
            </div>
            <div className={styles.statusTile}>
              <span className={styles.statusIcon}><Globe2 aria-hidden="true" /></span>
              <dt>Time zone</dt>
              <dd>{data.timezone}</dd>
            </div>
            <div className={styles.statusTile}>
              <span className={styles.statusIcon}><UserRoundCheck aria-hidden="true" /></span>
              <dt>Account status</dt>
              <dd><span className={`${styles.stateChip} ${data.isActive ? styles.positive : styles.danger}`}>{data.isActive ? 'Active' : 'Inactive'}</span></dd>
            </div>
            <div className={styles.statusTile}>
              <span className={styles.statusIcon}><CalendarCheck2 aria-hidden="true" /></span>
              <dt>This week</dt>
              <dd><span className={`${styles.stateChip} ${availabilityToneClass(data.availability.current)}`}>{availabilityLabel(data.availability.current)}</span></dd>
            </div>
            <div className={styles.statusTile}>
              <span className={styles.statusIcon}><CalendarCheck2 aria-hidden="true" /></span>
              <dt>Next week</dt>
              <dd><span className={`${styles.stateChip} ${availabilityToneClass(data.availability.next)}`}>{availabilityLabel(data.availability.next)}</span></dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}
