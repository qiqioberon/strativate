'use client'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/database.types'
import { authFormError, authPasswordError, authUsernameError } from '@/lib/auth/public-errors'
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
    const invalid = authPasswordError(password, confirmation, !passwordSaved) || (!recovery && authUsernameError(username))
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
    } catch (error) { setError(authFormError(error, 'We couldn\'t save your account. Check your details and try again.')) }
    finally { setBusy(false) }
  }
  return <form className="auth-form" onSubmit={submit}>
    {!recovery && <><label>First name<input name="first_name" defaultValue={profile.first_name || ''} required maxLength={100} /></label><label>Last name<input name="last_name" defaultValue={profile.last_name || ''} maxLength={100} /></label><label>Username<input name="username" defaultValue={profile.username || ''} required minLength={3} maxLength={30} autoComplete="username" /></label></>}
    <PasswordInput label="Password" language="en" name="password" required={!passwordSaved} autoComplete="new-password" minLength={8} maxLength={128} disabled={busy} />
    <p className="auth-password-requirements">Use at least 8 characters, including an uppercase letter, a number, and a symbol.</p>
    <PasswordInput label="Confirm password" language="en" name="confirmation" required={!passwordSaved} autoComplete="new-password" disabled={busy} />
    {passwordSaved && <p role="status">{recovery ? 'Password saved. Continue to your account.' : 'Password saved. Complete your account details to continue.'}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
  </form>
}
