'use client'

import { DashboardClient } from '@/app/dashboard/dashboard-client'
import { AccountProvider } from '@/components/auth/account-provider'
import type { Profile } from '@/lib/supabase/database.types'

const profile: Profile = {
  id: '92000000-0000-0000-0000-000000000003',
  role: 'mentee',
  first_name: 'User',
  last_name: 'Strativate',
  username: 'user',
  avatar_url: null,
  registration_method: 'email',
  mentor_setup_completed_at: null,
  password_set_at: '2026-09-01T00:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
}

export default function MenteeDashboardFixture() {
  return (
    <AccountProvider profile={profile} email="user@fixture.test">
      <DashboardClient digitalProductsEnabled ownedDigitalProducts={[]} />
    </AccountProvider>
  )
}
