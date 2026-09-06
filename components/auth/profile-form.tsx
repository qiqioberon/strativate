'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from './account-provider'
import { createClient } from '@/lib/supabase/client'
import { formError } from '@/lib/auth/errors'
import { usernameError } from '@/lib/auth/rules'
export function ProfileForm() {
  const profile = useAccount(), router = useRouter()
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaved(false)
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username')).trim()
    const invalid = usernameError(username)
    if (invalid) { setError(invalid); return }
    setBusy(true)
    try {
      const { error } = await createClient().from('profiles').update({ first_name: String(form.get('first_name')).trim(), last_name: String(form.get('last_name')).trim(), username, avatar_url: String(form.get('avatar_url') || '').trim() || null }).eq('id', profile.id)
      if (error) throw error
      setSaved(true); router.refresh()
    } catch (error) { setError(formError(error)) } finally { setBusy(false) }
  }
  return <section className="workspace-card account-profile"><h2>Profil akun</h2><form className="auth-form" onSubmit={submit}><label>Nama Depan<input name="first_name" defaultValue={profile.first_name || ''} required maxLength={100} /></label><label>Nama Belakang<input name="last_name" defaultValue={profile.last_name || ''} maxLength={100} /></label><label>Username<input name="username" defaultValue={profile.username || ''} required maxLength={30} /></label><label>URL Avatar<input name="avatar_url" type="url" defaultValue={profile.avatar_url || ''} maxLength={2048} placeholder="https://…" /></label>{error && <p className="form-error" role="alert">{error}</p>}{saved && <p role="status">Profil tersimpan.</p>}<button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan profil'}</button></form></section>
}
