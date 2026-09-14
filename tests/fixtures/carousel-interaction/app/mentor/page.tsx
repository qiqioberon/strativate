'use client'

import MentorDashboard from '@/app/mentor/dashboard/page'
import { AccountProvider } from '@/components/auth/account-provider'
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

export default function MentorDashboardFixture() {
  return (
    <AccountProvider profile={profile} email="mentor@fixture.test">
      <MentorDashboard />
    </AccountProvider>
  )
}
