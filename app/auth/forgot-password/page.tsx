import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { getAccount } from '@/lib/auth/server'

export default async function ForgotPasswordPage() {
  const account = await getAccount()
  if (account) redirect(account.destination)
  return <AuthShell><ForgotPasswordForm /></AuthShell>
}
