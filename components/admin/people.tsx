'use client'
import { displayLabel } from '@/lib/labels'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/database.types'
import { displayName } from '@/lib/auth/rules'
import { formError } from '@/lib/auth/errors'
import { inviteMentor } from '@/lib/admin/invite-mentor'
import { MentorInvitations } from './mentor-invitations'
export function PeopleManagement({ role }: { role: 'mentor' | 'mentee' }) {
  const [people, setPeople] = useState<Profile[]>([]), [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [page, setPage] = useState(0)
  const [invitationRefresh, setInvitationRefresh] = useState(0)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data, error } = await createClient().from('profiles').select('*').eq('role', role).order('created_at', { ascending: false }).range(page * 25, page * 25 + 24)
      if (error) throw error
      setPeople(data || [])
    } catch (error) { setError(formError(error)) } finally { setLoading(false) }
  }, [role, page])
  useEffect(() => { void load() }, [load])
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget, data = new FormData(form)
    try {
      const result = await inviteMentor(String(data.get('email') || ''))
      if (result.error) setError(result.error)
      else { setMessage(result.success || 'Undangan dikirim.'); form.reset(); await load() }
    } catch { setError('Undangan belum dapat dikirim. Coba lagi.') } finally { setBusy(false); setInvitationRefresh(value => value + 1) }
  }
  return <section className="role-card admin-data-panel"><h2>{role === 'mentor' ? "Kelola Mentor" : "Peserta"}</h2>
    {role === 'mentor' && <form className="auth-form" onSubmit={invite}><label>Email mentor<input name="email" type="email" required maxLength={254} /></label><button className="button button-primary" disabled={busy}>{busy ? 'Mengirim…' : "Undang Mentor"}</button></form>}
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status">{message}</p>}
    {role === 'mentor' && <MentorInvitations refreshKey={invitationRefresh} onDeleted={() => { setMessage(''); void load() }} />}
    <label className="search-field">Cari pada halaman ini<input value={query} onChange={e => setQuery(e.target.value)} /></label>
    {loading ? <p role="status">Memuat akun…</p> : people.filter(p => `${displayName(p)} ${p.username || ''}`.toLowerCase().includes(query.toLowerCase())).map(person => <div className="admin-record" key={person.id}><div><strong>{displayName(person)}</strong><small>@{person.username || 'belum-diatur'} · {person.id}</small><small>{new Date(person.created_at).toLocaleDateString('id-ID')}</small></div><span className="status-pill">{role === 'mentor' && !person.mentor_setup_completed_at ? "Menunggu pengaturan akun" : displayLabel(person.role)}</span></div>)}
    {!loading && people.length === 0 && <p>Belum ada akun pada halaman ini.</p>}
    <div className="button-row"><button className="button button-outline" onClick={() => setPage(p => p - 1)} disabled={page === 0 || loading}>Sebelumnya</button><button className="button button-outline" onClick={() => setPage(p => p + 1)} disabled={people.length < 25 || loading}>Berikutnya</button><button className="text-link" onClick={load} disabled={loading}>Muat ulang</button></div>
  </section>
}
