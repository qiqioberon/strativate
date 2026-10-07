import { redirect } from 'next/navigation'

import { AuthShell } from '@/components/auth/auth-shell'
import { SignOut } from '@/components/auth/sign-out'
import { getAccount } from '@/lib/auth/server'

export default async function InactiveMentorAccount() {
  const account = await getAccount()
  if (!account) redirect('/auth')
  if (account.destination !== '/auth/inactive') redirect(account.destination)

  return <AuthShell>
    <div className="auth-heading">
      <p className="kicker">Inactive mentor account</p>
      <h1>Dashboard access <em>disabled.</em></h1>
      <p>Your mentor account has been deactivated by an administrator. Contact the Strativate administrator to restore access.</p>
    </div>
    <SignOut className="button button-primary" language="en" />
  </AuthShell>
}
