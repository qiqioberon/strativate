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
      <p className="kicker">Akun mentor nonaktif</p>
      <h1>Akses dashboard <em>dinonaktifkan.</em></h1>
      <p>Akun mentor Anda sedang dinonaktifkan oleh administrator. Hubungi administrator Strativate jika akses perlu dipulihkan.</p>
    </div>
    <SignOut className="button button-primary" />
  </AuthShell>
}
