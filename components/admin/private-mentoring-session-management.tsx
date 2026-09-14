'use client'

import { CalendarDays, CheckCircle2, Clock3, Search, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

type SessionRow = {
  session_id: string; enrollment_id: string; mentee_id: string; mentee_email: string; session_number: number; status: string;
  session_focus_id: string | null; focus_name: string | null; mentor_id: string | null; mentor_name: string | null;
  scheduled_start_at: string | null; scheduled_end_at: string | null; mentor_tier_id: string; mentor_tier_code: string; mentor_tier_name: string; purchased_sessions: number
}
type MentorOption = { mentor_id: string; mentor_name: string; tier_id: string; tier_code: string; tier_name: string }

function statusMeta(status: string) {
  if (status === 'awaiting_focus') return { label: 'Menunggu fokus mentee', tone: 'warning' }
  if (status === 'awaiting_scheduling') return { label: 'Menunggu penjadwalan admin', tone: 'info' }
  if (status === 'scheduled') return { label: 'Terjadwal', tone: 'positive' }
  if (status === 'completed') return { label: 'Selesai', tone: 'neutral' }
  return { label: status.replaceAll('_', ' '), tone: 'neutral' }
}

function localDateTimeValue(value: string) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function durationLabel(row: SessionRow) {
  if (!row.scheduled_start_at || !row.scheduled_end_at) return 'Mengikuti durasi paket'
  const minutes = Math.round((new Date(row.scheduled_end_at).getTime() - new Date(row.scheduled_start_at).getTime()) / 60_000)
  return `${minutes} menit`
}

export function PrivateMentoringSessionManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [mentors, setMentors] = useState<MentorOption[]>([])
  const [mentorId, setMentorId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = sessions.find(row => row.session_id === selectedId) ?? null

  const load = useCallback(async (term = '') => {
    const { data, error: loadError } = await supabase.rpc('list_admin_private_mentoring_sessions', { p_query: term })
    if (loadError) { setError('Sesi Private Mentoring belum dapat dimuat.'); return }
    const rows = (data ?? []) as SessionRow[]
    setSessions(rows)
    setSelectedId(current => current && rows.some(row => row.session_id === current) ? current : (rows[0]?.session_id ?? ''))
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!selectedId) { setMentors([]); return }
    void supabase.rpc('list_eligible_private_mentoring_mentors', { p_session_id: selectedId }).then(({ data, error: mentorError }) => {
      if (mentorError) { setMentors([]); return }
      setMentors((data ?? []) as MentorOption[])
    })
  }, [selectedId, supabase])
  useEffect(() => {
    if (!selected) return
    setMentorId(selected.mentor_id ?? '')
    setStartAt(selected.scheduled_start_at ? localDateTimeValue(selected.scheduled_start_at) : '')
    setMessage(''); setError('')
  }, [selected])

  async function schedule() {
    if (!selected || !mentorId || !startAt) { setError('Pilih mentor dan jadwal.'); return }
    setBusy(true); setError(''); setMessage('')
    const { error: scheduleError } = await supabase.rpc('admin_schedule_private_mentoring_session', { p_session_id: selected.session_id, p_mentor_id: mentorId, p_scheduled_start_at: new Date(startAt).toISOString() })
    if (scheduleError) { setError(scheduleError.message); setBusy(false); return }
    setMessage('Jadwal sesi tersimpan.'); await load(query); setBusy(false)
  }

  async function complete() {
    if (!selected) return
    setBusy(true); setError(''); setMessage('')
    const { error: completeError } = await supabase.rpc('admin_set_private_mentoring_session_status', { p_session_id: selected.session_id, p_status: 'completed' })
    if (completeError) { setError(completeError.message); setBusy(false); return }
    setMessage('Sesi ditandai selesai.'); await load(query); setBusy(false)
  }

  const selectedStatus = selected ? statusMeta(selected.status) : null
  return <div className="ops-page mentoring-admin-page">
    <div className="role-page-title"><p className="kicker">Operasional · Private Mentoring</p><h2>Mentoring Sessions</h2><p>Pilih sesi, lalu kelola penugasan mentor dan jadwal tanpa mengubah aturan tier paket.</p></div>
    <div className="ops-filter-bar"><label className="ops-field ops-field--wide"><span>Cari sesi</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Mentee, tier, fokus, atau mentor" /></div></label><button className="button button-outline" type="button" onClick={() => void load(query)}>Cari</button></div>
    <div className="mentoring-admin-layout">
      <section className="role-card mentoring-admin-list" aria-label="Daftar sesi mentoring">
        <div className="ops-section-heading"><div><p className="kicker">Sesi</p><h3>{sessions.length} sesi</h3></div></div>
        <div className="mentoring-admin-list__scroll">{sessions.map(row => { const status = statusMeta(row.status); return <button type="button" className={`mentoring-admin-session ${row.session_id === selectedId ? 'is-selected' : ''}`} key={row.session_id} onClick={() => setSelectedId(row.session_id)}><span className="mentoring-admin-session__number">{row.session_number}</span><span><strong>{row.mentee_email}</strong><small>{row.mentor_tier_name} · {row.focus_name ?? 'Fokus belum dipilih'}</small><i className={`ops-status ops-status--${status.tone}`}>{status.label}</i></span></button>})}{sessions.length === 0 ? <p className="muted">Belum ada sesi yang cocok.</p> : null}</div>
      </section>

      <section className="role-card mentoring-admin-editor">
        {selected ? <>
          <div className="ops-section-heading"><div><p className="kicker">Kelola sesi</p><h3>{selected.mentee_email} · Sesi {selected.session_number}/{selected.purchased_sessions}</h3></div>{selectedStatus ? <span className={`ops-status ops-status--${selectedStatus.tone}`}>{selectedStatus.label}</span> : null}</div>

          <section className="mentoring-form-section"><div className="mentoring-form-section__title"><UserRound aria-hidden="true" /><div><span>Section 1</span><h4>Session Information</h4></div></div><div className="mentoring-form-grid"><div className="ops-readonly-field"><span>Mentee</span><strong>{selected.mentee_email}</strong></div><div className="ops-readonly-field"><span>Program / package</span><strong>Private Mentoring · {selected.mentor_tier_name}</strong></div><div className="ops-readonly-field"><span>Session number</span><strong>{selected.session_number} / {selected.purchased_sessions}</strong></div><div className="ops-readonly-field"><span>Current focus / topic</span><strong>{selected.focus_name ?? 'Belum dipilih mentee'}</strong></div></div></section>

          <section className="mentoring-form-section"><div className="mentoring-form-section__title"><UserRound aria-hidden="true" /><div><span>Section 2</span><h4>Mentor Assignment</h4></div></div><div className="mentoring-form-grid"><label className="ops-field"><span>Eligible mentor</span><select value={mentorId} onChange={event => setMentorId(event.target.value)} disabled={!selected.session_focus_id || selected.status === 'completed'}><option value="">Pilih mentor</option>{mentors.map(mentor => <option value={mentor.mentor_id} key={mentor.mentor_id}>{mentor.mentor_name}</option>)}</select></label><div className="ops-readonly-field"><span>Mentor tier wajib</span><strong>{selected.mentor_tier_name}</strong><small>Daftar mentor otomatis dibatasi ke tier paket.</small></div></div></section>

          <section className="mentoring-form-section"><div className="mentoring-form-section__title"><CalendarDays aria-hidden="true" /><div><span>Section 3</span><h4>Schedule</h4></div></div><div className="mentoring-form-grid"><label className="ops-field"><span>Date & start time</span><input type="datetime-local" value={startAt} onChange={event => setStartAt(event.target.value)} disabled={!selected.session_focus_id || selected.status === 'completed'} /></label><div className="ops-readonly-field"><span>Duration</span><strong>{durationLabel(selected)}</strong><small>Durasi ditentukan entitlement paket, bukan input bebas.</small></div>{selected.scheduled_start_at ? <div className="ops-readonly-field mentoring-form-grid__wide"><span>Current schedule</span><strong>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(selected.scheduled_start_at))}</strong></div> : null}</div></section>

          <section className="mentoring-form-section"><div className="mentoring-form-section__title"><Clock3 aria-hidden="true" /><div><span>Section 4</span><h4>Status / Action</h4></div></div><div className="mentoring-form-actions"><div><span>Current status</span><strong>{selectedStatus?.label}</strong></div><div className="button-row"><button className="button button-primary" type="button" onClick={() => void schedule()} disabled={busy || !selected.session_focus_id || selected.status === 'completed'}>{selected.status === 'scheduled' ? 'Simpan perubahan jadwal' : 'Jadwalkan sesi'}</button>{selected.status === 'scheduled' ? <button className="button button-outline" type="button" onClick={() => void complete()} disabled={busy}><CheckCircle2 aria-hidden="true" size={16} />Tandai selesai</button> : null}</div></div></section>
          {message ? <p className="ops-feedback ops-feedback--success" role="status">{message}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}
        </> : <p className="muted">Pilih sesi untuk mengelola penjadwalan.</p>}
      </section>
    </div>
  </div>
}
