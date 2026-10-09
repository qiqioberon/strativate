'use client'

import { Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { adminFormError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import { AccountPasswordSecurity } from './account-password-security'
import { useAccount } from './account-provider'

type AuthError = { code?: string; message: string }
type AuthUser = { email: string | null }
type AdminEmailAuth = {
  updateUser(attributes: { email: string }): Promise<{
    data: { user: AuthUser | null }
    error: AuthError | null
  }>
}

type EmailChangeResult =
  | { status: 'invalid'; message: string; displayEmail: string }
  | { status: 'failed'; error: AuthError; displayEmail: string }
  | { status: 'confirmation-pending' | 'updated'; displayEmail: string }

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320
}

export async function requestAdminEmailChange(
  auth: AdminEmailAuth,
  currentEmail: string,
  requestedEmail: string,
): Promise<EmailChangeResult> {
  const email = requestedEmail.trim().toLowerCase()
  const canonicalCurrentEmail = currentEmail.trim()
  if (!isValidEmail(email)) {
    return { status: 'invalid', message: 'Enter a valid email address.', displayEmail: canonicalCurrentEmail }
  }
  if (email === canonicalCurrentEmail.toLowerCase()) {
    return { status: 'invalid', message: 'Use a different email address.', displayEmail: canonicalCurrentEmail }
  }

  const result = await auth.updateUser({ email })
  if (result.error) return { status: 'failed', error: result.error, displayEmail: canonicalCurrentEmail }
  const returnedEmail = result.data.user?.email?.trim() ?? ''
  if (returnedEmail.toLowerCase() !== email) {
    return { status: 'confirmation-pending', displayEmail: canonicalCurrentEmail }
  }
  return { status: 'updated', displayEmail: returnedEmail }
}

export function AdminAccountSecurity() {
  const account = useAccount()
  const router = useRouter()
  const auth = useMemo(() => createClient().auth as unknown as AdminEmailAuth, [])
  const [email, setEmail] = useState(account.email ?? '')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailNotice, setEmailNotice] = useState('')

  useEffect(() => {
    setEmail(account.email ?? '')
  }, [account.email])

  if (account.role !== 'admin') return null

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (emailBusy) return
    setEmailError(''); setEmailNotice(''); setEmailBusy(true)
    try {
      const result = await requestAdminEmailChange(auth, account.email ?? '', email)
      if (result.status === 'invalid') { setEmailError(result.message); return }
      if (result.status === 'failed') { setEmailError(adminFormError(result.error, 'Your email could not be updated. Try again.')); return }
      setEmail(result.displayEmail)
      if (result.status === 'confirmation-pending') {
        setEmailNotice('Confirmation email sent. Your account will keep its current email address until you confirm the change.')
        return
      }
      setEmailNotice('Your account email has been updated.')
      router.refresh()
    } catch (error) {
      setEmailError(adminFormError(error, 'Your email could not be updated. Check your connection and try again.'))
    } finally {
      setEmailBusy(false)
    }
  }

  return <section className="workspace-card account-profile admin-account-security" aria-labelledby="admin-account-security-title">
    <div className="account-profile__header"><div><h2 id="admin-account-security-title">Email & password</h2><p>Changes apply to the Admin account you are signed in to.</p></div><ShieldCheck aria-hidden="true"/></div>
    <form className="auth-form account-security__form" onSubmit={submitEmail}>
      <div className="account-security__heading"><Mail aria-hidden="true"/><div><strong>Email address</strong><small>Current email: {account.email || 'Not available'}</small></div></div>
      <label>New email<input type="email" autoComplete="email" value={email} disabled={emailBusy} maxLength={320} aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? 'admin-email-error' : undefined} onChange={event=>setEmail(event.target.value)} required/></label>
      {emailError?<p id="admin-email-error" className="form-error" role="alert">{emailError}</p>:null}
      {emailNotice?<p className="form-success" role="status">{emailNotice}</p>:null}
      <div className="button-row"><button className="button button-primary" disabled={emailBusy}>{emailBusy?'Updating…':'Update email'}</button></div>
    </form>
    <AccountPasswordSecurity role="admin" language="en" />
  </section>
}
