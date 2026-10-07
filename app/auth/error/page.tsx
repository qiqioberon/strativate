import { AuthShell } from '@/components/auth/auth-shell'
import { SignOut } from '@/components/auth/sign-out'
export default function AuthError() {
  return <AuthShell><div className="auth-heading"><p className="kicker">Invalid sign-in link</p><h1>Try <em>again.</em></h1><p>Your sign-in link may have already been used or expired. Request a new link or sign in again. If your profile is unavailable, contact an administrator.</p></div><a href="/auth" className="button button-primary">Back to sign in</a><SignOut className="auth-text-link auth-sign-out" language="en" /></AuthShell>
}
