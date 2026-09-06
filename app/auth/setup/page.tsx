import { requireAccount } from '@/lib/auth/server'
import { AuthShell } from '@/components/auth/auth-shell'
import { SetupForm } from '@/components/auth/setup-form'
import { SignOut } from '@/components/auth/sign-out'
export default async function SetupPage() {
  const { profile } = await requireAccount('/auth/setup')
  return <AuthShell><div className="auth-heading"><p className="kicker">Selamat datang, mentor</p><h1>Siapkan <em>akunmu.</em></h1><p>Lengkapi nama, username, dan password untuk mulai mendampingi mentee.</p></div><SetupForm profile={profile} /><SignOut className="auth-back" /></AuthShell>
}
