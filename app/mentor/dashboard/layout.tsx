import { AccountProvider } from '@/components/auth/account-provider'
import { requireAccount } from '@/lib/auth/server'

export default async function MentorDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireAccount('/mentor/dashboard')

  return <AccountProvider profile={profile}>{children}</AccountProvider>
}
