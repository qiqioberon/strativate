import { requireAccount } from '@/lib/auth/server'
import { AuthShell } from '@/components/auth/auth-shell'
import { SetupForm } from '@/components/auth/setup-form'
export default async function RecoveryPage() {
  const { profile } = await requireAccount()
  return <AuthShell><div className="auth-heading"><p className="kicker">Account recovery</p><h1>Create a new <em>password.</em></h1><p>Choose a new password for your account.</p></div><SetupForm profile={profile} recovery /></AuthShell>
}
