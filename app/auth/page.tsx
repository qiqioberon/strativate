import { redirect } from 'next/navigation'
import { getAccount } from '@/lib/auth/server'
import { AuthShell } from '@/components/auth/auth-shell'
import { AuthForm } from '@/components/auth/auth-form'
export default async function AuthPage() {
  const account = await getAccount()
  if (account) redirect(account.destination)
  return <AuthShell><AuthForm /></AuthShell>
}
