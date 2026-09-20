'use client'

import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { formError } from '@/lib/auth/errors'
import { passwordError } from '@/lib/auth/rules'
import { createClient } from '@/lib/supabase/client'
import { useAccount } from './account-provider'
import { PasswordInput } from './password-input'

type AuthError = { code?: string; message: string }
type AuthUser = { email: string | null }
type AdminSecurityAuth = {
  updateUser(attributes: { email?: string; password?: string; nonce?: string }): Promise<{
    data: { user: AuthUser | null }
    error: AuthError | null
  }>
  reauthenticate(): Promise<{ data: unknown; error: AuthError | null }>
}

type EmailChangeResult =
  | { status: 'invalid'; message: string; displayEmail: string }
  | { status: 'failed'; error: AuthError; displayEmail: string }
  | { status: 'confirmation-pending' | 'updated'; displayEmail: string }

type PasswordChangeResult =
  | { status: 'invalid'; message: string }
  | { status: 'failed'; error: AuthError }
  | { status: 'reauthentication-required' | 'updated' }

type ReauthenticationResult =
  | { status: 'sent' }
  | { status: 'failed'; error: AuthError }

export type AdminPasswordSecrets = {
  password: string
  confirmation: string
  nonce: string
}

export function clearedAdminPasswordSecrets(): AdminPasswordSecrets {
  return { password: '', confirmation: '', nonce: '' }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320
}

function isReauthenticationError(error: AuthError | null) {
  return error?.code === 'reauthentication_needed' || error?.code === 'reauth_nonce_missing'
}

export async function requestAdminEmailChange(
  auth: AdminSecurityAuth,
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

export async function requestAdminPasswordChange(
  auth: AdminSecurityAuth,
  password: string,
  confirmation: string,
): Promise<PasswordChangeResult> {
  const invalid = passwordError(password, confirmation, true)
  if (invalid) return { status: 'invalid', message: invalid }

  const result = await auth.updateUser({ password })
  if (isReauthenticationError(result.error)) return { status: 'reauthentication-required' }
  if (result.error) return { status: 'failed', error: result.error }
  return { status: 'updated' }
}

export async function requestAdminReauthentication(
  auth: AdminSecurityAuth,
): Promise<ReauthenticationResult> {
  const result = await auth.reauthenticate()
  if (result.error) return { status: 'failed', error: result.error }
  return { status: 'sent' }
}

export async function confirmAdminPasswordChange(
  auth: AdminSecurityAuth,
  password: string,
  nonce: string,
): Promise<PasswordChangeResult> {
  const trimmedNonce = nonce.trim()
  if (!trimmedNonce) return { status: 'invalid', message: 'Masukkan kode verifikasi dari email.' }

  const result = await auth.updateUser({ password, nonce: trimmedNonce })
  if (result.error) return { status: 'failed', error: result.error }
  return { status: 'updated' }
}

export function AdminAccountSecurity() {
  const account = useAccount()
  const router = useRouter()
  const auth = useMemo(() => createClient().auth as unknown as AdminSecurityAuth, [])
  const [email, setEmail] = useState(account.email ?? '')
  const [emailBusy, setEmailBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [reauthenticationRequired, setReauthenticationRequired] = useState(false)
  const [secrets, setSecrets] = useState<AdminPasswordSecrets>(clearedAdminPasswordSecrets)
  const [emailError, setEmailError] = useState('')
  const [emailNotice, setEmailNotice] = useState('')
  const [passwordFormError, setPasswordFormError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')

  useEffect(() => {
    setEmail(account.email ?? '')
  }, [account.email])

  if (account.role !== 'admin') return null

  function clearPasswordSecrets() {
    setSecrets(clearedAdminPasswordSecrets())
    setReauthenticationRequired(false)
  }

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

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordFormError(''); setPasswordNotice(''); setPasswordBusy(true)
    const result = await requestAdminPasswordChange(auth, secrets.password, secrets.confirmation)
    setPasswordBusy(false)
    if (result.status === 'invalid') { setPasswordFormError(result.message); return }
    if (result.status === 'reauthentication-required') {
      setReauthenticationRequired(true)
      setSecrets(current => ({ ...current, confirmation: '', nonce: '' }))
      setPasswordNotice('Verifikasi ulang diperlukan sebelum kata sandi dapat diubah.')
      return
    }
    clearPasswordSecrets()
    if (result.status === 'failed') { setPasswordFormError(formError(result.error, 'Kata sandi belum dapat diperbarui. Coba lagi.')); return }
    setPasswordNotice('Kata sandi berhasil diperbarui.')
    router.refresh()
  }

  async function sendNonce() {
    setPasswordFormError(''); setPasswordNotice(''); setPasswordBusy(true)
    const result = await requestAdminReauthentication(auth)
    setPasswordBusy(false)
    if (result.status === 'failed') {
      clearPasswordSecrets()
      setPasswordFormError(formError(result.error, 'Kode verifikasi belum dapat dikirim. Mulai kembali perubahan kata sandi.'))
      return
    }
    setPasswordNotice('Kode verifikasi telah dikirim ke email akun Admin.')
  }

  async function confirmNonce(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordFormError(''); setPasswordNotice(''); setPasswordBusy(true)
    const result = await confirmAdminPasswordChange(auth, secrets.password, secrets.nonce)
    setPasswordBusy(false)
    if (result.status === 'invalid') { setPasswordFormError(result.message); return }
    clearPasswordSecrets()
    if (result.status === 'failed') { setPasswordFormError(formError(result.error, 'Kode tidak valid atau sudah kedaluwarsa. Mulai kembali perubahan kata sandi.')); return }
    setPasswordNotice('Kata sandi berhasil diperbarui.')
    router.refresh()
  }

  function cancelPasswordChange() {
    clearPasswordSecrets()
    setPasswordFormError('')
    setPasswordNotice('')
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
    {!reauthenticationRequired?<form className="auth-form account-security__form" onSubmit={submitPassword}>
      <div className="account-security__heading"><KeyRound aria-hidden="true"/><div><strong>Kata sandi</strong><small>Gunakan 8–128 karakter dengan huruf kapital, angka, dan simbol.</small></div></div>
      <PasswordInput label="Kata sandi baru" autoComplete="new-password" value={secrets.password} disabled={passwordBusy} onChange={event=>setSecrets(current=>({...current,password:event.target.value}))} required/>
      <PasswordInput label="Konfirmasi kata sandi" autoComplete="new-password" value={secrets.confirmation} disabled={passwordBusy} onChange={event=>setSecrets(current=>({...current,confirmation:event.target.value}))} required/>
      {passwordFormError?<p className="form-error" role="alert">{passwordFormError}</p>:null}
      {passwordNotice?<p className="form-success" role="status">{passwordNotice}</p>:null}
      <div className="button-row"><button className="button button-primary" disabled={passwordBusy}>{passwordBusy?'Memperbarui…':'Perbarui kata sandi'}</button></div>
    </form>:<form className="auth-form account-security__form" onSubmit={confirmNonce}>
      <div className="account-security__heading"><KeyRound aria-hidden="true"/><div><strong>Verifikasi perubahan</strong><small>Minta kode sekali pakai, lalu masukkan kode dari email akun.</small></div></div>
      <label>Kode verifikasi<input value={secrets.nonce} inputMode="numeric" autoComplete="one-time-code" disabled={passwordBusy} maxLength={20} onChange={event=>setSecrets(current=>({...current,nonce:event.target.value}))} required/></label>
      {passwordFormError?<p className="form-error" role="alert">{passwordFormError}</p>:null}
      {passwordNotice?<p className="form-success" role="status">{passwordNotice}</p>:null}
      <div className="button-row"><button type="button" className="button button-outline" disabled={passwordBusy} onClick={()=>void sendNonce()}>Kirim kode</button><button className="button button-primary" disabled={passwordBusy}>{passwordBusy?'Memverifikasi…':'Konfirmasi perubahan'}</button><button type="button" className="button button-outline" disabled={passwordBusy} onClick={cancelPasswordChange}>Batal</button></div>
    </form>}
  </section>
}
