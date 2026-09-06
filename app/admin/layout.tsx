import { requireAccount } from '@/lib/auth/server'
import { AccountProvider } from '@/components/auth/account-provider'
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAccount('/admin')
  return <AccountProvider profile={profile}>{children}</AccountProvider>
}
