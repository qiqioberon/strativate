'use client'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/database.types'
import { passwordError, usernameError } from '@/lib/auth/rules'
import { formError } from '@/lib/auth/errors'
import { PasswordInput } from "./password-input"
export function SetupForm({ profile, recovery = false }: { profile: Profile; recovery?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(!recovery && !!profile.password_set_at)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const form = event.currentTarget
    const data = new FormData(form)
    const password = String(data.get('password') || '')
    const confirmation = String(data.get('confirmation') || '')
    const username = String(data.get('username') || '').trim()
    const invalid = passwordError(password, confirmation, !passwordSaved) || (!recovery && usernameError(username))
    if (invalid) { setError(invalid); return }
    setBusy(true)
    try {
      const supabase = createClient()
      if (password) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setPasswordSaved(true)
        ;(form.elements.namedItem('password') as HTMLInputElement).value = ''
        ;(form.elements.namedItem('confirmation') as HTMLInputElement).value = ''
      }
      if (!recovery) {
        const { error } = await supabase.rpc('complete_mentor_setup', { p_first_name: String(data.get('first_name')).trim(), p_last_name: String(data.get('last_name') || '').trim(), p_username: username })
        if (error) throw error
      }
      window.location.assign('/auth/continue')
    } catch (error) { setError(formError(error, 'Akun belum dapat disimpan. Periksa data dan coba lagi.')) }
    finally { setBusy(false) }
  }
  return <form className="auth-form" onSubmit={submit}>
    {!recovery && <><label>Nama Depan<input name="first_name" defaultValue={profile.first_name || ''} required maxLength={100} /></label><label>Nama Belakang<input name="last_name" defaultValue={profile.last_name || ''} maxLength={100} /></label><label>Nama pengguna<input name="username" defaultValue={profile.username || ''} required minLength={3} maxLength={30} autoComplete="username" /></label></>}
    <PasswordInput label="Kata sandi" name="password" required={!passwordSaved} autoComplete="new-password" minLength={8} maxLength={128} disabled={busy} />
    <PasswordInput label="Konfirmasi kata sandi" name="confirmation" required={!passwordSaved} autoComplete="new-password" disabled={busy} />
    {passwordSaved && <p role="status">Kata sandi tersimpan. Lengkapi data akun untuk melanjutkan.</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan dan lanjutkan'}</button>
  </form>
}
