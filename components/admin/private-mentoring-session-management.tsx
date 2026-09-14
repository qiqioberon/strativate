'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

type SessionRow = {
  session_id: string; enrollment_id: string; mentee_id: string; mentee_email: string; session_number: number; status: string;
  session_focus_id: string | null; focus_name: string | null; mentor_id: string | null; mentor_name: string | null;
  scheduled_start_at: string | null; scheduled_end_at: string | null; mentor_tier_id: string; mentor_tier_code: string; mentor_tier_name: string; purchased_sessions: number
}
type MentorOption = { mentor_id: string; mentor_name: string; tier_id: string; tier_code: string; tier_name: string }

export function PrivateMentoringSessionManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [mentors, setMentors] = useState<MentorOption[]>([])
  const [mentorId, setMentorId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [message, setMessage] = useState('')
  const selected = sessions.find(row => row.session_id === selectedId) ?? null

  const load = useCallback(async (term = '') => {
    const { data, error } = await supabase.rpc('list_admin_private_mentoring_sessions', { p_query: term })
    if (error) { setMessage('Sesi Private Mentoring belum dapat dimuat.'); return }
    const rows = (data ?? []) as SessionRow[]
    setSessions(rows)
    setSelectedId(current => current && rows.some(row => row.session_id === current) ? current : (rows[0]?.session_id ?? ''))
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!selectedId) { setMentors([]); return }
    void supabase.rpc('list_eligible_private_mentoring_mentors', { p_session_id: selectedId }).then(({ data, error }) => {
      if (error) { setMentors([]); return }
      setMentors((data ?? []) as MentorOption[])
    })
  }, [selectedId, supabase])
  useEffect(() => {
    if (!selected) return
    setMentorId(selected.mentor_id ?? '')
    setStartAt(selected.scheduled_start_at ? new Date(selected.scheduled_start_at).toISOString().slice(0, 16) : '')
  }, [selected])

  async function schedule() {
    if (!selected || !mentorId || !startAt) { setMessage('Pilih mentor dan jadwal.'); return }
    const { error } = await supabase.rpc('admin_schedule_private_mentoring_session', {
      p_session_id: selected.session_id,
      p_mentor_id: mentorId,
      p_scheduled_start_at: new Date(startAt).toISOString(),
    })
    if (error) { setMessage(error.message); return }
    setMessage('Jadwal sesi tersimpan.'); await load(query)
  }

  async function complete() {
    if (!selected) return
    const { error } = await supabase.rpc('admin_set_private_mentoring_session_status', { p_session_id: selected.session_id, p_status: 'completed' })
    if (error) { setMessage(error.message); return }
    setMessage('Sesi ditandai selesai.'); await load(query)
  }

  return <>
    <div className="role-page-title"><p className="kicker">Operasional · Private Mentoring</p><h2>Mentoring Sessions</h2><p>Admin menetapkan mentor dan jadwal per sesi. Daftar mentor selalu dibatasi ke tier paket yang dibeli.</p></div>
    <div className="table-controls"><label className="search-field"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari mentee, tier, fokus, atau mentor" /></label><button className="button button-outline" onClick={() => load(query)}>Cari</button></div>
    <div className="split-board">
      <section className="role-card"><p className="kicker">Sesi</p>{sessions.map(row => <button type="button" className="unassigned-row" key={row.session_id} onClick={() => setSelectedId(row.session_id)}><div><strong>{row.mentee_email} · sesi {row.session_number}/{row.purchased_sessions}</strong><p>{row.mentor_tier_name} · {row.focus_name ?? 'Menunggu fokus mentee'}</p><small>{row.status}</small></div></button>)}{sessions.length === 0 ? <p className="muted">Belum ada sesi yang cocok.</p> : null}</section>
      <section className="role-card">
        <p className="kicker">Penjadwalan admin</p>
        {selected ? <><h2>{selected.mentee_email} · sesi {selected.session_number}</h2><div className="confirmation-grid"><div><span>Tier wajib</span><strong>{selected.mentor_tier_name}</strong></div><div><span>Fokus</span><strong>{selected.focus_name ?? 'Belum dipilih mentee'}</strong></div><div><span>Mentor saat ini</span><strong>{selected.mentor_name ?? 'Belum ditetapkan'}</strong></div><div><span>Status</span><strong>{selected.status}</strong></div></div>
          <label className="form-label">Mentor sesuai tier<select value={mentorId} onChange={event => setMentorId(event.target.value)} disabled={!selected.session_focus_id || selected.status === 'completed'}><option value="">Pilih mentor</option>{mentors.map(mentor => <option value={mentor.mentor_id} key={mentor.mentor_id}>{mentor.mentor_name} · {mentor.tier_name}</option>)}</select></label>
          <label className="form-label">Mulai sesi<input type="datetime-local" value={startAt} onChange={event => setStartAt(event.target.value)} disabled={!selected.session_focus_id || selected.status === 'completed'} /></label>
          <div className="button-row"><button className="button button-primary" type="button" onClick={schedule} disabled={!selected.session_focus_id || selected.status === 'completed'}>{selected.status === 'scheduled' ? 'Ubah jadwal' : 'Jadwalkan sesi'}</button>{selected.status === 'scheduled' ? <button className="button button-outline" type="button" onClick={complete}>Tandai selesai</button> : null}</div>
          {selected.scheduled_start_at ? <p className="muted">Jadwal tersimpan: {new Date(selected.scheduled_start_at).toLocaleString('id-ID')} – {selected.scheduled_end_at ? new Date(selected.scheduled_end_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</p> : null}</> : <p className="muted">Pilih sesi untuk mengelola penjadwalan.</p>}
        {message ? <p className="muted" role="status">{message}</p> : null}
      </section>
    </div>
  </>
}
