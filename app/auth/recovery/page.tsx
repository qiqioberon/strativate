import { requireAccount } from '@/lib/auth/server'
import { AuthShell } from '@/components/auth/auth-shell'
import { SetupForm } from '@/components/auth/setup-form'
export default async function RecoveryPage() {
  const { profile } = await requireAccount()
  return <AuthShell><div className="auth-heading"><h1>Password <em>baru.</em></h1><p>Buat password baru untuk akunmu.</p></div><SetupForm profile={profile} recovery /></AuthShell>
}
