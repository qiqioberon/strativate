'use client'

import { Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { formError } from '@/lib/auth/errors'
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
    return { status: 'invalid', message: 'Masukkan alamat email yang valid.', displayEmail: canonicalCurrentEmail }
  }
  if (email === canonicalCurrentEmail.toLowerCase()) {
    return { status: 'invalid', message: 'Gunakan alamat email yang berbeda.', displayEmail: canonicalCurrentEmail }
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
    setEmailError(''); setEmailNotice(''); setEmailBusy(true)
    const result = await requestAdminEmailChange(auth, account.email ?? '', email)
    setEmailBusy(false)
    if (result.status === 'invalid') { setEmailError(result.message); return }
    if (result.status === 'failed') { setEmailError(formError(result.error, 'Email belum dapat diperbarui. Coba lagi.')); return }
    setEmail(result.displayEmail)
    if (result.status === 'confirmation-pending') {
      setEmailNotice('Tautan konfirmasi telah dikirim. Email akun tetap menggunakan alamat saat ini sampai perubahan dikonfirmasi.')
      return
    }
    setEmailNotice('Email akun berhasil diperbarui.')
    router.refresh()
  }

  return <section className="workspace-card account-profile admin-account-security" aria-labelledby="admin-account-security-title">
    <div className="account-profile__header"><div><p className="kicker">Keamanan Admin</p><h2 id="admin-account-security-title">Email & kata sandi</h2><p>Perubahan diterapkan hanya ke akun Admin yang sedang masuk.</p></div><ShieldCheck aria-hidden="true"/></div>
    <form className="auth-form account-security__form" onSubmit={submitEmail}>
      <div className="account-security__heading"><Mail aria-hidden="true"/><div><strong>Alamat email</strong><small>Email saat ini: {account.email || 'Belum tersedia'}</small></div></div>
      <label>Email baru<input type="email" autoComplete="email" value={email} disabled={emailBusy} maxLength={320} onChange={event=>setEmail(event.target.value)} required/></label>
      {emailError?<p className="form-error" role="alert">{emailError}</p>:null}
      {emailNotice?<p className="form-success" role="status">{emailNotice}</p>:null}
      <div className="button-row"><button className="button button-primary" disabled={emailBusy}>{emailBusy?'Memperbarui…':'Perbarui email'}</button></div>
    </form>
    <AccountPasswordSecurity role="admin" />
  </section>
}
