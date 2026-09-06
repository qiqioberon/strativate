import { requireAccount } from '@/lib/auth/server'
import { AccountProvider } from '@/components/auth/account-provider'
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAccount('/dashboard')
  return <AccountProvider profile={profile}>{children}</AccountProvider>
}
