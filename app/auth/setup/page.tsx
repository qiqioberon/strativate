import { requireAccount } from '@/lib/auth/server'
import { AuthShell } from '@/components/auth/auth-shell'
import { SetupForm } from '@/components/auth/setup-form'
import { SignOut } from '@/components/auth/sign-out'
export default async function SetupPage() {
  const { profile } = await requireAccount('/auth/setup')
  return <AuthShell><div className="auth-heading"><p className="kicker">Welcome, mentor</p><h1>Set up your <em>account.</em></h1><p>Add your name, username, and password to start guiding mentees.</p></div><SetupForm profile={profile} /><SignOut className="auth-text-link auth-sign-out" language="en" /></AuthShell>
}
