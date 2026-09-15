import { AccountProvider } from '@/components/auth/account-provider'
import { requireAccount } from '@/lib/auth/server'

import './mentor-operations.css'

export default async function MentorDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile, user } = await requireAccount('/mentor/dashboard')

  return <AccountProvider profile={profile} email={user.email ?? null}>{children}</AccountProvider>
}
