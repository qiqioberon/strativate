'use client'
import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formError } from '@/lib/auth/errors'
import {
  clearBrowserAuthPersistenceMode,
  setBrowserAuthPersistenceMode,
  type AuthPersistenceMode,
} from '@/lib/auth/session-persistence'
import { PasswordInput } from './password-input'
import { SessionChoiceDialog } from './session-choice-dialog'

type PendingLogin =
  | { kind: 'password'; email: string; password: string }
  | { kind: 'google' }

export function AuthForm() {
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingLogin, setPendingLogin] = useState<PendingLogin | null>(null)
  const inFlight = useRef(false)
  const locked = busy || pendingLogin !== null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked || inFlight.current) return
    setError(''); setMessage('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email')).trim()
    if (!register) {
      setPendingLogin({ kind: 'password', email, password: String(data.get('password')) })
      return
    }

    inFlight.current = true
    setBusy(true)
    try {
      clearBrowserAuthPersistenceMode()
      const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
      if (error) throw error
      setMessage('Jika email dapat diproses, tautan masuk akan dikirim. Periksa kotak masuk dan folder spam.')
    } catch (error) {
      setError(formError(error, 'Tautan belum dapat dikirim. Silakan coba lagi.'))
    } finally { inFlight.current = false; setBusy(false) }
  }

  function google() {
    if (locked || inFlight.current) return
    setError(''); setMessage('')
    setPendingLogin({ kind: 'google' })
  }

  async function authenticate(mode: AuthPersistenceMode) {
    const login = pendingLogin
    if (!login || inFlight.current) return
    inFlight.current = true
    setBusy(true); setError('')
    try {
      setBrowserAuthPersistenceMode(mode)
      const supabase = createClient()
      if (login.kind === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email: login.email, password: login.password })
        if (error) throw error
        window.location.assign('/auth/continue')
        return
      }

      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })
      if (error) throw error
    } catch (error) {
      clearBrowserAuthPersistenceMode()
      setPendingLogin(null)
      inFlight.current = false
      setError(formError(error, login.kind === 'google'
        ? 'Google belum dapat dihubungkan. Silakan coba lagi.'
        : 'Tidak dapat masuk. Periksa email dan kata sandi, lalu coba lagi.'))
      setBusy(false)
    }
  }

  function cancelPersistenceChoice() {
    if (!busy && !inFlight.current) setPendingLogin(null)
  }

  return <>
    <div className="auth-heading"><p className="kicker">{register ? 'Mulai perjalananmu' : 'Selamat datang kembali'}</p><h1>{register ? <>Daftar di <em>Strativate.</em></> : <>Raih kemenangan <em>berikutnya.</em></>}</h1><p>{register ? 'Masukkan email untuk menerima tautan verifikasi dan melengkapi profilmu.' : 'Masuk untuk melanjutkan perjalananmu bersama Strativate.'}</p></div>
    <form className="auth-form" onSubmit={submit}>
      <label>Email<input name="email" type="email" required autoComplete="email" maxLength={254} disabled={locked} /></label>
      {!register && <PasswordInput label="Kata sandi" name="password" required autoComplete="current-password" disabled={locked} />}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <button className="button button-primary full-button" disabled={locked}>{busy ? 'Memproses…' : register ? 'Kirim tautan email' : 'Masuk'}<ArrowRight size={16} /></button>
      <button className="button button-outline full-button" type="button" onClick={google} disabled={locked}>Lanjutkan dengan Google</button>
      <button className="button button-outline full-button auth-mode-switch" type="button" disabled={locked} onClick={() => { setRegister(!register); setError(''); setMessage('') }} data-testid="auth-mode-switch">{register ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}</button>
    </form>
    <SessionChoiceDialog open={pendingLogin !== null} busy={busy} onChoose={authenticate} onCancel={cancelPersistenceChoice} />
  </>
}
