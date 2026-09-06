import { requireAccount } from '@/lib/auth/server'
import { AccountProvider } from '@/components/auth/account-provider'
export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAccount('/mentor')
  return <AccountProvider profile={profile}>{children}</AccountProvider>
}
