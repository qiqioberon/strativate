'use client'

import { Camera, Pencil, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { ProfileAvatar } from './profile-avatar'
import { ProfileAvatarEditor } from './profile-avatar-editor'
import { usernameError } from '@/lib/auth/rules'
import { normalizeWhatsAppNumber, whatsAppNumberError } from '@/lib/profile/whatsapp'
import { createClient } from '@/lib/supabase/client'
import { useAccount } from './account-provider'
import { AccountPasswordSecurity } from './account-password-security'
import { AdminAccountSecurity } from './admin-account-security'
import { accountFormError, accountMessage, type AccountLanguage } from '@/lib/auth/account-presentation'
import styles from './profile-form.module.css'

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

export function ProfileForm({ language = 'id' }: { language?: AccountLanguage }) {
  const en = language === 'en'
  const text = (english: string, indonesian: string) => en ? english : indonesian
  const account = useAccount() as ProfileWithContact
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [avatarOpen,setAvatarOpen]=useState(false)
  const [avatarOverride,setAvatarOverride]=useState<string|null>(null)

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
      setError(accountMessage(invalidUsername || invalidWhatsApp || '', language, 'Check your username and WhatsApp number.'))
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
      }).eq('id', account.id)
      if (updateError) throw updateError
      setSaved(true)
      setEditing(false)
      router.refresh()
    } catch (caught) {
      setError(accountFormError(caught, language, 'Permintaan gagal. Periksa koneksi dan coba lagi.', 'Your profile could not be saved. Check your connection and try again.'))
    } finally {
      setBusy(false)
    }
  }

  const fullName = [account.first_name, account.last_name].filter(Boolean).join(' ')
  const whatsapp = account.whatsapp_number ?? null

  const content = <><section className="workspace-card account-profile">
    <div className="profile-avatar-edit-row"><button type="button" className="profile-avatar-edit-trigger" onClick={()=>setAvatarOpen(true)} aria-label={text('Edit profile photo', 'Ubah foto profil')}><ProfileAvatar account={account} srcOverride={avatarOverride}/><span><Camera aria-hidden="true"/></span></button><div><strong>{text('Profile photo', 'Foto profil')}</strong>{!en ? <p>Foto tampil konsisten di dashboard dan menu akun.</p> : null}</div></div>
    <ProfileAvatarEditor language={language} open={avatarOpen} onClose={()=>setAvatarOpen(false)} onSaved={(url, cleanupWarning)=>{setAvatarOverride(url);setSaved(true);setError(cleanupWarning ?? '');router.refresh()}}/>
    <div className="account-profile__header">
      <div>{!en ? <p className="kicker">Akun</p> : null}<h2>{text('Profile', 'Profil akun')}</h2>{!en ? <p>Informasi profil ditampilkan read-only sampai Anda memilih mode edit.</p> : null}</div>
      {!editing ? <button type="button" className="profile-edit-button" onClick={() => { setEditing(true); setError(''); setSaved(false) }} aria-label={text('Edit profile', 'Edit profil')} title={text('Edit profile', 'Edit profil')}><Pencil aria-hidden="true" /></button> : <button type="button" className="profile-edit-button" disabled={busy} onClick={() => { if (!busy) setEditing(false) }} aria-label={text('Cancel editing', 'Batal edit profil')} title={text('Cancel editing', 'Batal edit')}><X aria-hidden="true" /></button>}
    </div>

    {!whatsapp ? <div className="profile-whatsapp-reminder" role="note"><strong>{text('Add your WhatsApp number', 'Tambahkan nomor WhatsApp')}</strong><span>{text('Optional, but useful if the Strativate team needs to contact you about your sessions.', 'Nomor ini opsional, tetapi membantu tim Strativate menghubungi Anda untuk kebutuhan operasional.')}</span></div> : null}

    {editing ? <form className="auth-form account-profile__form" onSubmit={submit}>
      <label>{text('First name', 'Nama Depan')}<input name="first_name" defaultValue={account.first_name || ''} required maxLength={100} /></label>
      <label>{text('Last name', 'Nama Belakang')}<input name="last_name" defaultValue={account.last_name || ''} maxLength={100} /></label>
      <label>{text('Username', 'Nama pengguna')}<input name="username" defaultValue={account.username || ''} required maxLength={30} /></label>
      <label>Email<input value={account.email || ''} readOnly aria-readonly="true" /></label>
      <label>{text('WhatsApp number', 'Nomor WhatsApp')} <span className="profile-field-optional">{text('Optional', 'Opsional')}</span><input name="whatsapp_number" type="tel" inputMode="tel" defaultValue={whatsapp || ''} maxLength={24} placeholder="08123456789" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? text('Saving…', 'Menyimpan…') : text('Save profile', 'Simpan profil')}</button><button className="button button-outline" type="button" disabled={busy} onClick={() => setEditing(false)}>{text('Cancel', 'Batal')}</button></div>
    </form> : <dl className="account-profile__details">
      <div><dt>{text('Name', 'Nama')}</dt><dd>{displayValue(fullName, text('Not provided', 'Belum diisi'))}</dd></div>
      <div><dt>{text('Username', 'Nama pengguna')}</dt><dd>{account.username ? `@${account.username}` : text('Not provided', 'Belum diisi')}</dd></div>
      <div><dt>Email</dt><dd>{displayValue(account.email, text('Not provided', 'Belum diisi'))}</dd></div>
      <div><dt>WhatsApp</dt><dd>{displayValue(whatsapp, text('Not provided', 'Belum diisi'))}</dd></div>
    </dl>}
    {saved && !editing ? <p className="account-profile__saved" role="status">{text('Profile saved.', 'Profil tersimpan.')}</p> : null}
    {error && !editing ? <p className="form-error" role="alert">{error}</p> : null}
  </section>{account.role === 'admin' ? <AdminAccountSecurity/> : account.role === 'mentor' ? <AccountPasswordSecurity role="mentor" language={language} /> : account.role === 'mentee' ? <AccountPasswordSecurity role="mentee" language={language} /> : null}</>
  return en ? <div className={styles.stack}>{content}</div> : content
}
