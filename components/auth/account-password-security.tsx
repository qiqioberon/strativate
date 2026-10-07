'use client'

import { KeyRound, ShieldCheck } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { accountFormError, accountMessage, type AccountLanguage } from '@/lib/auth/account-presentation'
import { passwordError } from '@/lib/auth/rules'
import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from './password-input'

type AuthError = { code?: string; message: string }
type AuthUser = { email: string | null }
type AccountPasswordAuth = {
  updateUser(attributes: { password: string; nonce?: string }): Promise<{
    data: { user: AuthUser | null }
    error: AuthError | null
  }>
  reauthenticate(): Promise<{ data: unknown; error: AuthError | null }>
}

type PasswordChangeResult =
  | { status: 'invalid'; message: string }
  | { status: 'failed'; error: AuthError }
  | { status: 'reauthentication-required' | 'updated' }

type ReauthenticationResult =
  | { status: 'sent' }
  | { status: 'failed'; error: AuthError }

export type AccountPasswordSecrets = {
  password: string
  confirmation: string
  nonce: string
}

export function clearedAccountPasswordSecrets(): AccountPasswordSecrets {
  return { password: '', confirmation: '', nonce: '' }
}

function isReauthenticationError(error: AuthError | null) {
  return error?.code === 'reauthentication_needed' || error?.code === 'reauth_nonce_missing'
}

export async function requestPasswordChange(
  auth: AccountPasswordAuth,
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

export async function requestPasswordReauthentication(
  auth: AccountPasswordAuth,
): Promise<ReauthenticationResult> {
  const result = await auth.reauthenticate()
  if (result.error) return { status: 'failed', error: result.error }
  return { status: 'sent' }
}

export async function confirmPasswordChange(
  auth: AccountPasswordAuth,
  password: string,
  nonce: string,
): Promise<PasswordChangeResult> {
  const trimmedNonce = nonce.trim()
  if (!trimmedNonce) return { status: 'invalid', message: 'Masukkan kode verifikasi dari email.' }

  const result = await auth.updateUser({ password, nonce: trimmedNonce })
  if (result.error) return { status: 'failed', error: result.error }
  return { status: 'updated' }
}

export function AccountPasswordSecurity({ role, language = 'id' }: { role: 'admin' | 'mentor' | 'mentee'; language?: AccountLanguage }) {
  const en = language === 'en'
  const text = (english: string, indonesian: string) => en ? english : indonesian
  const router = useRouter()
  const auth = useMemo(() => createClient().auth as unknown as AccountPasswordAuth, [])
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [reauthenticationRequired, setReauthenticationRequired] = useState(false)
  const [secrets, setSecrets] = useState<AccountPasswordSecrets>(clearedAccountPasswordSecrets)
  const [passwordFormError, setPasswordFormError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')

  function clearPasswordSecrets() {
    setSecrets(clearedAccountPasswordSecrets())
    setReauthenticationRequired(false)
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordFormError(''); setPasswordNotice(''); setPasswordBusy(true)
    const result = await requestPasswordChange(auth, secrets.password, secrets.confirmation)
    setPasswordBusy(false)
    if (result.status === 'invalid') { setPasswordFormError(accountMessage(result.message, language, 'Check your password and confirmation.')); return }
    if (result.status === 'reauthentication-required') {
      setReauthenticationRequired(true)
      setSecrets(current => ({ ...current, confirmation: '', nonce: '' }))
      setPasswordNotice(text('Verification is required before you can change your password.', 'Verifikasi ulang diperlukan sebelum kata sandi dapat diubah.'))
      return
    }
    clearPasswordSecrets()
    if (result.status === 'failed') { setPasswordFormError(accountFormError(result.error, language, 'Kata sandi belum dapat diperbarui. Coba lagi.', 'Your password could not be updated. Try again.')); return }
    setPasswordNotice(text('Password updated.', 'Kata sandi berhasil diperbarui.'))
    router.refresh()
  }

  async function sendNonce() {
    setPasswordFormError(''); setPasswordNotice(''); setPasswordBusy(true)
    const result = await requestPasswordReauthentication(auth)
    setPasswordBusy(false)
    if (result.status === 'failed') {
      clearPasswordSecrets()
      setPasswordFormError(accountFormError(result.error, language, 'Kode verifikasi belum dapat dikirim. Mulai kembali perubahan kata sandi.', 'The verification code could not be sent. Start the password change again.'))
      return
    }
    setPasswordNotice(text('A verification code has been sent to your account email.', `Kode verifikasi telah dikirim ke email akun ${role === 'admin' ? 'Admin' : role === 'mentor' ? 'Mentor' : 'Mentee'}.`))
  }

  async function confirmNonce(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordFormError(''); setPasswordNotice(''); setPasswordBusy(true)
    const result = await confirmPasswordChange(auth, secrets.password, secrets.nonce)
    setPasswordBusy(false)
    if (result.status === 'invalid') { setPasswordFormError(accountMessage(result.message, language, 'Enter the verification code from your email.')); return }
    clearPasswordSecrets()
    if (result.status === 'failed') { setPasswordFormError(accountFormError(result.error, language, 'Kode tidak valid atau sudah kedaluwarsa. Mulai kembali perubahan kata sandi.', 'The code is invalid or has expired. Start the password change again.')); return }
    setPasswordNotice(text('Password updated.', 'Kata sandi berhasil diperbarui.'))
    router.refresh()
  }

  function cancelPasswordChange() {
    clearPasswordSecrets()
    setPasswordFormError('')
    setPasswordNotice('')
  }

  const passwordForm = !reauthenticationRequired ? <form className="auth-form account-security__form" onSubmit={submitPassword}>
    <div className="account-security__heading">{!en ? <KeyRound aria-hidden="true"/> : null}<div>{!en ? <strong>Kata sandi</strong> : null}<small>{text('Use 8–128 characters with an uppercase letter, a number, and a symbol.', 'Gunakan 8–128 karakter dengan huruf kapital, angka, dan simbol.')}</small></div></div>
    <PasswordInput language={language} label={text('New password', 'Kata sandi baru')} autoComplete="new-password" value={secrets.password} disabled={passwordBusy} onChange={event=>setSecrets(current=>({...current,password:event.target.value}))} required/>
    <PasswordInput language={language} label={text('Confirm password', 'Konfirmasi kata sandi')} autoComplete="new-password" value={secrets.confirmation} disabled={passwordBusy} onChange={event=>setSecrets(current=>({...current,confirmation:event.target.value}))} required/>
    {passwordFormError?<p className="form-error" role="alert">{passwordFormError}</p>:null}
    {passwordNotice?<p className="form-success" role="status">{passwordNotice}</p>:null}
    <div className="button-row"><button className="button button-primary" disabled={passwordBusy}>{passwordBusy ? text('Updating…', 'Memperbarui…') : text('Update password', 'Perbarui kata sandi')}</button></div>
  </form>:<form className="auth-form account-security__form" onSubmit={confirmNonce}>
    <div className="account-security__heading"><KeyRound aria-hidden="true"/><div><strong>{text('Verification required', 'Verifikasi perubahan')}</strong><small>{text('Request a code, then enter it from your account email.', 'Minta kode sekali pakai, lalu masukkan kode dari email akun.')}</small></div></div>
    <label>{text('Verification code', 'Kode verifikasi')}<input value={secrets.nonce} inputMode="numeric" autoComplete="one-time-code" disabled={passwordBusy} maxLength={20} onChange={event=>setSecrets(current=>({...current,nonce:event.target.value}))} required/></label>
    {passwordFormError?<p className="form-error" role="alert">{passwordFormError}</p>:null}
    {passwordNotice?<p className="form-success" role="status">{passwordNotice}</p>:null}
    <div className="button-row"><button type="button" className="button button-outline" disabled={passwordBusy} onClick={()=>void sendNonce()}>{text('Send code', 'Kirim kode')}</button><button className="button button-primary" disabled={passwordBusy}>{passwordBusy ? text('Verifying…', 'Memverifikasi…') : text('Confirm change', 'Konfirmasi perubahan')}</button><button type="button" className="button button-outline" disabled={passwordBusy} onClick={cancelPasswordChange}>{text('Cancel', 'Batal')}</button></div>
  </form>

  if (role === 'admin') return passwordForm

  const roleLabel = role === 'mentor' ? 'Mentor' : 'Mentee'

  return <section className="workspace-card account-profile admin-account-security" aria-labelledby="account-password-security-title">
    <div className="account-profile__header"><div>{!en ? <p className="kicker">Keamanan akun</p> : null}<h2 id="account-password-security-title">{text('Account security', 'Kata sandi')}</h2>{!en ? <p>Perbarui kata sandi untuk akun {roleLabel} yang sedang masuk.</p> : null}</div><ShieldCheck aria-hidden="true"/></div>
    {passwordForm}
  </section>
}
