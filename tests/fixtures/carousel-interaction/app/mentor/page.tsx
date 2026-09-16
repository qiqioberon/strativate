'use client'

import { AccountProvider } from '@/components/auth/account-provider'
import { MentorDashboardClient } from '@/components/mentor/mentor-dashboard-client'
import type { MentorDashboardData } from '@/lib/mentor/dashboard'
import type { MyMentorPublicProfileData } from '@/lib/mentor/public-profile-types'
import type { Profile } from '@/lib/supabase/database.types'

const profile: Profile = {
  id: '92000000-0000-0000-0000-000000000002',
  role: 'mentor',
  first_name: 'Mentor',
  last_name: 'Strativate',
  username: 'mentor',
  avatar_url: null,
  registration_method: 'email',
  mentor_setup_completed_at: '2026-09-01T00:00:00.000Z',
  password_set_at: '2026-09-01T00:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
}

const dashboardData: MentorDashboardData = {
  sessions: [
    {
      session_id: '93000000-0000-0000-0000-000000000001',
      enrollment_id: '94000000-0000-0000-0000-000000000001',
      mentee_id: '95000000-0000-0000-0000-000000000001',
      mentee_name: 'Alya Pratama',
      mentee_email: 'alya@fixture.test',
      session_number: 2,
      purchased_sessions: 3,
      status: 'scheduled',
      focus_name: 'Case structuring',
      scheduled_start_at: '2026-09-17T02:00:00.000Z',
      scheduled_end_at: '2026-09-17T03:00:00.000Z',
      mentor_timezone: 'Asia/Jakarta',
      duration_minutes: 60,
      meeting_url: 'https://meet.google.com/fixture-room',
      google_event_id: 'fixture-event-1',
      google_ical_uid: 'fixture-ical-1',
      google_sync_status: 'synced',
    },
    {
      session_id: '93000000-0000-0000-0000-000000000002',
      enrollment_id: '94000000-0000-0000-0000-000000000001',
      mentee_id: '95000000-0000-0000-0000-000000000001',
      mentee_name: 'Alya Pratama',
      mentee_email: 'alya@fixture.test',
      session_number: 1,
      purchased_sessions: 3,
      status: 'completed',
      focus_name: 'Problem definition',
      scheduled_start_at: '2026-09-10T02:00:00.000Z',
      scheduled_end_at: '2026-09-10T03:00:00.000Z',
      mentor_timezone: 'Asia/Jakarta',
      duration_minutes: 60,
      meeting_url: null,
      google_event_id: 'fixture-event-2',
      google_ical_uid: 'fixture-ical-2',
      google_sync_status: 'synced',
    },
    {
      session_id: '93000000-0000-0000-0000-000000000003',
      enrollment_id: '94000000-0000-0000-0000-000000000002',
      mentee_id: '95000000-0000-0000-0000-000000000002',
      mentee_name: 'Bima Santoso',
      mentee_email: 'bima@fixture.test',
      session_number: 1,
      purchased_sessions: 2,
      status: 'cancelled',
      focus_name: 'Presentation review',
      scheduled_start_at: '2026-09-11T06:00:00.000Z',
      scheduled_end_at: '2026-09-11T07:00:00.000Z',
      mentor_timezone: 'Asia/Jakarta',
      duration_minutes: 60,
      meeting_url: null,
      google_event_id: 'fixture-event-3',
      google_ical_uid: 'fixture-ical-3',
      google_sync_status: 'cancelled',
    },
  ],
  tierName: 'Top Student',
  timezone: 'Asia/Jakarta',
  isActive: true,
  availability: { current: true, next: false },
  sessionError: null,
  metadataError: null,
}

const publicProfile: MyMentorPublicProfileData = {
  profile: {
    id: '96000000-0000-0000-0000-000000000001',
    public_slug: 'mentor-strativate',
    display_name: 'Mentor Strativate',
    tier_id: '81000000-0000-0000-0000-000000000001',
    tier_name: 'Top Student',
    headline: 'Business Case Mentor',
    linkedin_url: 'https://www.linkedin.com/in/mentor-strativate/',
    short_bio: 'Mentor fixture untuk pengujian profil publik yang terpisah dari data akun dan operasional.',
    portrait_asset_key: 'mentors.navira-putri.portrait',
    portrait_url: null,
    photo_status: 'ready',
    publication_status: 'draft',
    sort_order: 10,
  },
  achievements: [
    { id: '97000000-0000-0000-0000-000000000001', achievement: 'Winner of Business Case Competition', sort_order: 10 },
    { id: '97000000-0000-0000-0000-000000000002', achievement: 'Case Team Lead', sort_order: 20 },
  ],
  expertise_ids: [
    '82000000-0000-0000-0000-000000000003',
    '82000000-0000-0000-0000-000000000005',
  ],
  expertise_options: [
    { id: '82000000-0000-0000-0000-000000000002', name: 'Business Plan', slug: 'business-plan', sort_order: 20, is_active: true, assigned: false },
    { id: '82000000-0000-0000-0000-000000000003', name: 'Business Case', slug: 'business-case', sort_order: 30, is_active: true, assigned: true },
    { id: '82000000-0000-0000-0000-000000000005', name: 'Finance', slug: 'finance', sort_order: 50, is_active: false, assigned: true },
  ],
}

export default function MentorDashboardFixture() {
  return (
    <AccountProvider profile={profile} email="mentor@fixture.test">
      <MentorDashboardClient
        initialData={dashboardData}
        initialPublicProfile={publicProfile}
        publicProfileError={null}
      />
    </AccountProvider>
  )
}
