'use client'
import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formError } from '@/lib/auth/errors'
import { PasswordInput } from "./password-input"
export function AuthForm() {
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email')).trim()
    try {
      const supabase = createClient()
      if (register) {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
        if (error) throw error
        setMessage("Jika email dapat diproses, tautan masuk akan dikirim. Periksa kotak masuk dan folder spam.")
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: String(data.get('password')) })
        if (error) throw error
        window.location.assign('/auth/continue')
      }
    } catch (error) { setError(formError(error, register ? 'Tautan belum dapat dikirim. Silakan coba lagi.' : "Tidak dapat masuk. Periksa email dan kata sandi, lalu coba lagi.")) }
    finally { setBusy(false) }
  }
  async function google() {
    setBusy(true); setError('')
    try {
      const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })
      if (error) throw error
    } catch (error) { setError(formError(error, 'Google belum dapat dihubungkan. Silakan coba lagi.')); setBusy(false) }
  }
  return <><div className="auth-heading"><p className="kicker">{register ? 'Buat akunmu' : "Selamat datang kembali"}</p><h1>{register ? <>Mulai di <em>Strativate.</em></> : <>Siapkan langkah <em>berikutnya.</em></>}</h1><p>{register ? 'Masukkan email untuk menerima tautan verifikasi, lalu lengkapi profilmu.' : 'Masuk untuk melanjutkan persiapan bersama mentor dan materi yang sesuai.'}</p></div><form className="auth-form" onSubmit={submit}>
    <label>Email<input name="email" type="email" required autoComplete="email" maxLength={254} disabled={busy} /></label>
    {!register && <PasswordInput label="Kata sandi" name="password" required autoComplete="current-password" disabled={busy} />}
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button className="button button-primary full-button" disabled={busy}>{busy ? 'Memproses…' : register ? 'Kirim tautan email' : 'Masuk'}<ArrowRight size={16} /></button>
    <button className="button button-outline full-button" type="button" onClick={google} disabled={busy}>Lanjutkan dengan Google</button>
    <button className="text-link" type="button" disabled={busy} onClick={() => { setRegister(!register); setError(''); setMessage('') }}>{register ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}</button>
  </form></>
}
