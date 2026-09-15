'use client'

import { Pencil, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { formError } from '@/lib/auth/errors'
import { usernameError } from '@/lib/auth/rules'
import { normalizeWhatsAppNumber, whatsAppNumberError } from '@/lib/profile/whatsapp'
import { createClient } from '@/lib/supabase/client'
import { useAccount } from './account-provider'

type ProfileWithContact = ReturnType<typeof useAccount> & { whatsapp_number?: string | null }
type ProfileUpdateClient = {
  from(name: 'profiles'): {
    update(values: Record<string, unknown>): {
      eq(column: 'id', value: string): PromiseLike<{ error: { message: string } | null }>
    }
  }
}

function displayValue(value: string | null | undefined, fallback = 'Belum diisi') {
  return value?.trim() || fallback
}

export function ProfileForm() {
  const account = useAccount() as ProfileWithContact
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaved(false)
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username')).trim()
    const whatsappInput = String(form.get('whatsapp_number') || '')
    const invalidUsername = usernameError(username)
    const invalidWhatsApp = whatsAppNumberError(whatsappInput)
    if (invalidUsername || invalidWhatsApp) {
      setError(invalidUsername || invalidWhatsApp || '')
      return
    }

    setBusy(true)
    try {
      const client = createClient() as unknown as ProfileUpdateClient
      const { error: updateError } = await client.from('profiles').update({
        first_name: String(form.get('first_name')).trim(),
        last_name: String(form.get('last_name')).trim(),
        username,
        whatsapp_number: normalizeWhatsAppNumber(whatsappInput),
        avatar_url: String(form.get('avatar_url') || '').trim() || null,
      }).eq('id', account.id)
      if (updateError) throw updateError
      setSaved(true)
      setEditing(false)
      router.refresh()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setBusy(false)
    }
  }

  const fullName = [account.first_name, account.last_name].filter(Boolean).join(' ')
  const whatsapp = account.whatsapp_number ?? null

  return <section className="workspace-card account-profile">
    <div className="account-profile__header">
      <div><p className="kicker">Akun</p><h2>Profil akun</h2><p>Informasi profil ditampilkan read-only sampai Anda memilih mode edit.</p></div>
      {!editing ? <button type="button" className="profile-edit-button" onClick={() => { setEditing(true); setError(''); setSaved(false) }} aria-label="Edit profil" title="Edit profil"><Pencil aria-hidden="true" /></button> : <button type="button" className="profile-edit-button" onClick={() => { if (!busy) setEditing(false) }} aria-label="Batal edit profil" title="Batal edit"><X aria-hidden="true" /></button>}
    </div>

    {!whatsapp ? <div className="profile-whatsapp-reminder" role="note"><strong>Tambahkan nomor WhatsApp</strong><span>Nomor ini opsional, tetapi membantu tim Strativate menghubungi Anda untuk kebutuhan operasional.</span></div> : null}

    {editing ? <form className="auth-form account-profile__form" onSubmit={submit}>
      <label>Nama Depan<input name="first_name" defaultValue={account.first_name || ''} required maxLength={100} /></label>
      <label>Nama Belakang<input name="last_name" defaultValue={account.last_name || ''} maxLength={100} /></label>
      <label>Nama pengguna<input name="username" defaultValue={account.username || ''} required maxLength={30} /></label>
      <label>Email<input value={account.email || ''} readOnly aria-readonly="true" /></label>
      <label>Nomor WhatsApp <span className="profile-field-optional">Opsional</span><input name="whatsapp_number" type="tel" inputMode="tel" defaultValue={whatsapp || ''} maxLength={24} placeholder="08123456789" /></label>
      <label>URL Foto Profil<input name="avatar_url" type="url" defaultValue={account.avatar_url || ''} maxLength={2048} placeholder="https://…" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan profil'}</button><button className="button button-outline" type="button" disabled={busy} onClick={() => setEditing(false)}>Batal</button></div>
    </form> : <dl className="account-profile__details">
      <div><dt>Nama</dt><dd>{displayValue(fullName)}</dd></div>
      <div><dt>Nama pengguna</dt><dd>{account.username ? `@${account.username}` : 'Belum diisi'}</dd></div>
      <div><dt>Email</dt><dd>{displayValue(account.email)}</dd></div>
      <div><dt>WhatsApp</dt><dd>{displayValue(whatsapp)}</dd></div>
      <div className="account-profile__details-wide"><dt>URL Foto Profil</dt><dd>{displayValue(account.avatar_url)}</dd></div>
    </dl>}
    {saved && !editing ? <p className="account-profile__saved" role="status">Profil tersimpan.</p> : null}
  </section>
}
