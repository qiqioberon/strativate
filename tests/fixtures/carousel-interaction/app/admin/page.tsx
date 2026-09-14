'use client'

import AdminDashboard from '@/app/admin/page'
import { AccountProvider } from '@/components/auth/account-provider'
import type { Profile } from '@/lib/supabase/database.types'

const profile: Profile = {
  id: '92000000-0000-0000-0000-000000000001',
  role: 'admin',
  first_name: 'Admin',
  last_name: 'Strativate',
  username: 'admin',
  avatar_url: null,
  registration_method: 'email',
  mentor_setup_completed_at: null,
  password_set_at: '2026-09-01T00:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
}

export default function AdminDashboardFixture() {
  return (
    <AccountProvider profile={profile} email="admin@fixture.test">
      <AdminDashboard />
    </AccountProvider>
  )
}
