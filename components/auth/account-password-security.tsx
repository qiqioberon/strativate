'use client'

import { KeyRound, ShieldCheck } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { formError } from '@/lib/auth/errors'
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

export function AccountPasswordSecurity({ role }: { role: 'admin' | 'mentor' }) {
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
    const result = await requestPasswordReauthentication(auth)
    setPasswordBusy(false)
    if (result.status === 'failed') {
      clearPasswordSecrets()
      setPasswordFormError(formError(result.error, 'Kode verifikasi belum dapat dikirim. Mulai kembali perubahan kata sandi.'))
      return
    }
    setPasswordNotice(`Kode verifikasi telah dikirim ke email akun ${role === 'admin' ? 'Admin' : 'Mentor'}.`)
  }

  async function confirmNonce(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordFormError(''); setPasswordNotice(''); setPasswordBusy(true)
    const result = await confirmPasswordChange(auth, secrets.password, secrets.nonce)
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

  const passwordForm = !reauthenticationRequired ? <form className="auth-form account-security__form" onSubmit={submitPassword}>
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
  </form>

  if (role === 'admin') return passwordForm

  return <section className="workspace-card account-profile admin-account-security" aria-labelledby="mentor-account-security-title">
    <div className="account-profile__header"><div><p className="kicker">Keamanan akun</p><h2 id="mentor-account-security-title">Kata sandi</h2><p>Perbarui kata sandi untuk akun Mentor yang sedang masuk.</p></div><ShieldCheck aria-hidden="true"/></div>
    {passwordForm}
  </section>
}
