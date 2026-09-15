import { MentorDashboardClient } from '@/components/mentor/mentor-dashboard-client'
import { requireAccount } from '@/lib/auth/server'
import { loadMentorDashboardData } from '@/lib/mentor/dashboard-server'

export default async function MentorDashboard() {
  const account = await requireAccount('/mentor/dashboard')
  if (!account.mentor) throw new Error('Status akun mentor belum dapat dimuat. Hubungi administrator.')

  const data = await loadMentorDashboardData(account.user.id, account.mentor)
  return <MentorDashboardClient initialData={data} />
}
