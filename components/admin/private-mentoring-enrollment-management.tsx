'use client'

import { CalendarDays, CheckCircle2, Clock3, Search, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { EligiblePrivateMentoringMentor, MentorTier, PrivateMentoringPackage } from '@/lib/supabase/database.types'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'

type EnrollmentRow = { total_count:number; enrollment_id:string; mentee_id:string; mentee_email:string; mentee_username:string; mentee_name:string; order_item_id:string; order_id:string; package_id:string; package_name:string; mentor_tier_id:string; mentor_tier_code:string; mentor_tier_name:string; purchased_sessions:number; awaiting_focus_sessions:number; awaiting_scheduling_sessions:number; scheduled_sessions:number; completed_sessions:number; configured_sessions:number; enrollment_status:string; purchased_at:string }
type SessionRow = { session_id:string; enrollment_id:string; session_number:number; status:string; session_focus_id:string|null; focus_name:string|null; mentor_id:string|null; mentor_name:string|null; scheduled_start_at:string|null; scheduled_end_at:string|null; mentor_tier_id:string; mentor_tier_code:string; mentor_tier_name:string; purchased_sessions:number }
type RpcError = { message: string }
type RpcClient = { rpc<T>(name: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }> }
type StatusTone = 'warning' | 'info' | 'positive' | 'neutral'
type EnrollmentSortKey = 'user' | 'email' | 'package' | 'purchased_at' | 'progress' | 'status'

const DATE = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })
const DATE_TIME = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' })
function statusMeta(status: string): { label: string; tone: StatusTone } {
  if (status === 'awaiting_focus') return { label: 'Menunggu fokus mentee', tone: 'warning' }
  if (status === 'awaiting_scheduling') return { label: 'Menunggu penjadwalan admin', tone: 'info' }
  if (status === 'scheduled') return { label: 'Terjadwal', tone: 'positive' }
  if (status === 'completed') return { label: 'Selesai', tone: 'neutral' }
  return { label: status.replaceAll('_', ' '), tone: 'neutral' }
}
function enrollmentStatus(row: EnrollmentRow) {
  if (row.completed_sessions === row.purchased_sessions) return { label: 'Selesai', tone: 'neutral' as const }
  if (row.awaiting_focus_sessions > 0) return { label: 'Menunggu fokus', tone: 'warning' as const }
  if (row.awaiting_scheduling_sessions > 0) return { label: 'Perlu dijadwalkan', tone: 'info' as const }
  if (row.configured_sessions === row.purchased_sessions) return { label: 'Semua sesi diatur', tone: 'positive' as const }
  return { label: 'Berjalan', tone: 'positive' as const }
}
function localDateTimeValue(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) }
function durationLabel(row: SessionRow) { if (!row.scheduled_start_at || !row.scheduled_end_at) return 'Mengikuti durasi paket'; const minutes = Math.round((new Date(row.scheduled_end_at).getTime() - new Date(row.scheduled_start_at).getTime()) / 60_000); return `${minutes} menit` }
function packageLabel(pkg: PrivateMentoringPackage, tiers: MentorTier[]) { const tier = tiers.find(item => item.id === pkg.mentor_tier_id); return `${tier?.name ?? 'Private Mentoring'} · ${pkg.session_count} sesi` }

export function PrivateMentoringSessionManagement() {
  const supabase = useMemo(() => createClient(), [])
  const rpcClient = useMemo(() => supabase as unknown as RpcClient, [supabase])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState(''), [packageId, setPackageId] = useState(''), [tierId, setTierId] = useState(''), [progress, setProgress] = useState('all'), [fromDate, setFromDate] = useState(''), [toDate, setToDate] = useState('')
  const [pageSize, setPageSize] = useState(10), [page, setPage] = useState(0), [total, setTotal] = useState(0)
  const [sortKey, setSortKey] = useState<EnrollmentSortKey | null>(null), [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]), [loading, setLoading] = useState(true), [packages, setPackages] = useState<PrivateMentoringPackage[]>([]), [tiers, setTiers] = useState<MentorTier[]>([])
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentRow | null>(null), [sessions, setSessions] = useState<SessionRow[]>([]), [selectedSessionId, setSelectedSessionId] = useState(''), [mentors, setMentors] = useState<EligiblePrivateMentoringMentor[]>([]), [mentorId, setMentorId] = useState(''), [startAt, setStartAt] = useState('')
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const selectedSession = sessions.find(row => row.session_id === selectedSessionId) ?? null

  const loadCatalog = useCallback(async () => {
    const [packageResult, tierResult] = await Promise.all([supabase.from('private_mentoring_packages').select('*').order('sort_order').order('id'), supabase.from('mentor_tiers').select('*').eq('is_active', true).order('sort_order').order('name')])
    if (packageResult.error || tierResult.error) { setError('Filter paket Private Mentoring belum dapat dimuat.'); return }
    setPackages(packageResult.data ?? []); setTiers(tierResult.data ?? [])
  }, [supabase])
  const loadEnrollments = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: loadError } = await rpcClient.rpc<EnrollmentRow[]>('list_admin_private_mentoring_enrollments_page', { p_query:query.trim(), p_package_id:packageId||null, p_tier_id:tierId||null, p_progress:progress, p_from:fromDate||null, p_to:toDate||null, p_limit:pageSize, p_offset:page*pageSize })
    if (loadError) { setError('Daftar pesanan Private Mentoring belum dapat dimuat.'); setLoading(false); return }
    const rows = data ?? []
    if (rows.length === 0 && page > 0) { setPage(value => Math.max(0, value - 1)); setLoading(false); return }
    setEnrollments(rows); setSelectedEnrollment(current => current ? (rows.find(row => row.enrollment_id === current.enrollment_id) ?? null) : null); setTotal(Number(rows[0]?.total_count ?? 0)); setLoading(false)
  }, [fromDate, packageId, page, pageSize, progress, query, rpcClient, tierId, toDate])
  const loadEnrollmentSessions = useCallback(async (enrollmentId: string, preferredSessionId = '') => {
    const { data, error: sessionError } = await rpcClient.rpc<SessionRow[]>('get_admin_private_mentoring_enrollment_sessions', { p_enrollment_id: enrollmentId })
    if (sessionError) { setError('Detail sesi belum dapat dimuat.'); setSessions([]); setSelectedSessionId(''); return }
    const rows = data ?? []; setSessions(rows); const next = rows.find(row => row.session_id === preferredSessionId) ?? rows.find(row => row.status !== 'completed') ?? rows[0]; setSelectedSessionId(next?.session_id ?? '')
  }, [rpcClient])

  useEffect(() => { void loadCatalog() }, [loadCatalog])
  useEffect(() => { const timer = setTimeout(() => { void loadEnrollments() }, 250); return () => clearTimeout(timer) }, [loadEnrollments])
  useEffect(() => { const dialog = dialogRef.current; if (!dialog) return; if (selectedEnrollment && !dialog.open) dialog.showModal(); if (!selectedEnrollment && dialog.open) dialog.close() }, [selectedEnrollment])
  useEffect(() => {
    if (!selectedSession) { setMentors([]); setMentorId(''); setStartAt(''); return }
    setMentorId(selectedSession.mentor_id ?? ''); setStartAt(selectedSession.scheduled_start_at ? localDateTimeValue(selectedSession.scheduled_start_at) : ''); setMessage(''); setError('')
    void rpcClient.rpc<EligiblePrivateMentoringMentor[]>('list_eligible_private_mentoring_mentors', { p_session_id: selectedSession.session_id }).then(({ data, error: mentorError }) => { setMentors(mentorError ? [] : (data ?? [])) })
  }, [rpcClient, selectedSession])

  const visibleEnrollments = useMemo(() => {
    if (!sortKey || !sortDirection) return enrollments
    const sign = sortDirection === 'asc' ? 1 : -1
    return [...enrollments].sort((a, b) => {
      if (sortKey === 'purchased_at') return (new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime()) * sign
      if (sortKey === 'progress') return ((a.configured_sessions / Math.max(1, a.purchased_sessions)) - (b.configured_sessions / Math.max(1, b.purchased_sessions))) * sign
      const left = sortKey === 'user' ? a.mentee_name : sortKey === 'email' ? a.mentee_email : sortKey === 'package' ? a.package_name : enrollmentStatus(a).label
      const right = sortKey === 'user' ? b.mentee_name : sortKey === 'email' ? b.mentee_email : sortKey === 'package' ? b.package_name : enrollmentStatus(b).label
      return left.localeCompare(right, 'id-ID') * sign
    })
  }, [enrollments, sortDirection, sortKey])
  function changeSort(key: string | null, direction: SortDirection) { setSortKey(key as EnrollmentSortKey | null); setSortDirection(direction) }
  function resetFilters() { setQuery(''); setPackageId(''); setTierId(''); setProgress('all'); setFromDate(''); setToDate(''); setPage(0) }
  async function openEnrollment(row: EnrollmentRow) { setSelectedEnrollment(row); setSessions([]); setSelectedSessionId(''); setMessage(''); setError(''); await loadEnrollmentSessions(row.enrollment_id) }
  async function refreshSelected(preferredSessionId = selectedSessionId) { if (!selectedEnrollment) return; await Promise.all([loadEnrollmentSessions(selectedEnrollment.enrollment_id, preferredSessionId), loadEnrollments()]) }
  async function schedule() {
    if (!selectedSession || !mentorId || !startAt) { setError('Pilih mentor dan jadwal untuk sesi ini.'); return }
    setBusy(true); setError(''); setMessage('')
    const { error: scheduleError } = await rpcClient.rpc('admin_schedule_private_mentoring_session', { p_session_id:selectedSession.session_id, p_mentor_id:mentorId, p_scheduled_start_at:new Date(startAt).toISOString() })
    if (scheduleError) { setError(scheduleError.message); setBusy(false); return }
    setMessage(`Jadwal sesi ${selectedSession.session_number} tersimpan.`); await refreshSelected(selectedSession.session_id); setBusy(false)
  }
  async function complete() {
    if (!selectedSession) return
    setBusy(true); setError(''); setMessage('')
    const { error: completeError } = await rpcClient.rpc('admin_set_private_mentoring_session_status', { p_session_id:selectedSession.session_id, p_status:'completed' })
    if (completeError) { setError(completeError.message); setBusy(false); return }
    setMessage(`Sesi ${selectedSession.session_number} ditandai selesai.`); await refreshSelected(selectedSession.session_id); setBusy(false)
  }

  const selectedStatus = selectedSession ? statusMeta(selectedSession.status) : null
  const allConfigured = Boolean(selectedEnrollment && selectedEnrollment.configured_sessions === selectedEnrollment.purchased_sessions)

  return <div className="ops-page mentoring-admin-page mentoring-enrollment-page">
    <div className="role-page-title"><p className="kicker">Operasional · Private Mentoring</p><h2>Mentoring Sessions</h2><p>Satu baris mewakili satu paket yang dibeli. Seluruh sesi paket dikelola dari dialog.</p></div>
    <div className="ops-filter-bar mentoring-enrollment-filters"><label className="ops-field ops-field--wide"><span>Cari user</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15} /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Username, nama, email, atau paket" /></div></label><label className="ops-field"><span>Paket</span><select value={packageId} onChange={event => { setPackageId(event.target.value); setPage(0) }}><option value="">Semua paket</option>{packages.map(pkg => <option value={pkg.id} key={pkg.id}>{packageLabel(pkg, tiers)}</option>)}</select></label><label className="ops-field"><span>Tier</span><select value={tierId} onChange={event => { setTierId(event.target.value); setPage(0) }}><option value="">Semua tier</option>{tiers.map(tier => <option value={tier.id} key={tier.id}>{tier.name}</option>)}</select></label><label className="ops-field"><span>Progress</span><select value={progress} onChange={event => { setProgress(event.target.value); setPage(0) }}><option value="all">Semua progress</option><option value="needs_focus">Menunggu fokus</option><option value="needs_scheduling">Perlu dijadwalkan</option><option value="configured">Semua sesi diatur</option><option value="in_progress">Sedang berjalan</option><option value="completed">Selesai</option></select></label><label className="ops-field"><span>Dari tanggal beli</span><input type="date" value={fromDate} onChange={event => { setFromDate(event.target.value); setPage(0) }} /></label><label className="ops-field"><span>Sampai</span><input type="date" value={toDate} onChange={event => { setToDate(event.target.value); setPage(0) }} /></label><label className="ops-field"><span>Per halaman</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><button className="button button-outline" type="button" onClick={resetFilters}>Reset</button></div>
    {error && !selectedEnrollment ? <p className="form-error" role="alert">{error}</p> : null}
    <section className="role-card ops-table-section">
      <div className="ops-section-heading"><div><p className="kicker">Pesanan mentoring</p><h3>{total} paket</h3><p>Satu row per enrollment/paket, bukan satu row per sesi.</p></div></div>
      <div className="ops-table-wrap"><table className="ops-table mentoring-enrollment-table"><thead><tr><SortableTableHeader label="User" sortKey="user" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Email" sortKey="email" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Paket" sortKey="package" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Tanggal beli" sortKey="purchased_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Progress" sortKey="progress" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th>Aksi</th></tr></thead><tbody>
        {visibleEnrollments.map(row => { const state = enrollmentStatus(row); return <tr key={row.enrollment_id}><td><strong>{row.mentee_name}</strong><small className="ops-table-secondary">@{row.mentee_username || 'username-belum-diatur'}</small></td><td>{row.mentee_email}</td><td><strong>{row.package_name}</strong><small className="ops-table-secondary">{row.mentor_tier_name} · {row.purchased_sessions} sesi</small></td><td>{DATE.format(new Date(row.purchased_at))}</td><td><strong>{row.configured_sessions}/{row.purchased_sessions} diatur</strong><small className="ops-table-secondary">{row.completed_sessions} selesai · {row.awaiting_focus_sessions} tunggu fokus</small></td><td><span className={`ops-status ops-status--${state.tone}`}>{state.label}</span></td><td><button type="button" className="button button-outline" onClick={() => void openEnrollment(row)}>Kelola</button></td></tr>})}
        {!loading && enrollments.length === 0 ? <tr><td colSpan={7}><p className="muted">Belum ada pesanan mentoring yang cocok dengan filter.</p></td></tr> : null}
      </tbody></table></div>
      {loading ? <p className="muted" role="status">Memuat pesanan mentoring…</p> : null}<TablePagination page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} disabled={loading} label="Pagination pesanan mentoring" />
    </section>

    <dialog ref={dialogRef} className="ops-dialog mentoring-enrollment-dialog" aria-labelledby="mentoring-enrollment-dialog-title" onClose={() => setSelectedEnrollment(null)} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}>
      {selectedEnrollment ? <div className="ops-dialog__surface">
        <header className="ops-dialog__header"><div><p className="kicker">Kelola sesi</p><h2 id="mentoring-enrollment-dialog-title">{selectedEnrollment.mentee_name}</h2><p>{selectedEnrollment.mentee_email} · {selectedEnrollment.package_name}</p></div><button className="ops-icon-button" type="button" aria-label="Tutup kelola sesi" onClick={() => dialogRef.current?.close()}><X aria-hidden="true" /></button></header>
        <div className="ops-detail-grid mentoring-enrollment-summary"><div><span>Username</span><strong>@{selectedEnrollment.mentee_username || 'belum-diatur'}</strong></div><div><span>Paket / tier</span><strong>{selectedEnrollment.mentor_tier_name} · {selectedEnrollment.purchased_sessions} sesi</strong></div><div><span>Tanggal beli</span><strong>{DATE.format(new Date(selectedEnrollment.purchased_at))}</strong></div><div><span>Progress</span><strong>{selectedEnrollment.configured_sessions}/{selectedEnrollment.purchased_sessions} diatur · {selectedEnrollment.completed_sessions} selesai</strong></div></div>
        <label className="mentoring-all-configured"><input type="checkbox" checked={allConfigured} readOnly /><span><strong>Semua sesi sudah diatur</strong><small>{allConfigured ? 'Mentor dan jadwal tersedia untuk seluruh sesi.' : `${selectedEnrollment.purchased_sessions - selectedEnrollment.configured_sessions} sesi masih memerlukan pengaturan.`}</small></span></label>
        <section className="ops-dialog__section"><div className="ops-section-heading"><div><p className="kicker">Checklist sesi</p><h3>{sessions.length} sesi dalam paket</h3></div></div><div className="mentoring-session-checklist">{sessions.map(session => { const configured = Boolean(session.session_focus_id && session.mentor_id && session.scheduled_start_at); const state = statusMeta(session.status); return <label className={`mentoring-session-check ${session.session_id === selectedSessionId ? 'is-active' : ''}`} key={session.session_id}><input type="checkbox" checked={configured} readOnly /><span><strong>Sesi {session.session_number}</strong><small>{session.focus_name ?? 'Fokus belum dipilih'} · {session.mentor_name ?? 'Mentor belum dipilih'}</small></span><i className={`ops-status ops-status--${state.tone}`}>{state.label}</i></label>})}</div></section>
        <section className="mentoring-form-section"><div className="mentoring-form-section__title"><UserRound aria-hidden="true" /><div><span>Session Information</span><h4>Pilih sesi yang ingin dikelola</h4></div></div><div className="mentoring-form-grid"><label className="ops-field mentoring-form-grid__wide"><span>Kelola sesi</span><select value={selectedSessionId} onChange={event => setSelectedSessionId(event.target.value)}>{sessions.map(session => <option value={session.session_id} key={session.session_id}>Sesi {session.session_number} · {statusMeta(session.status).label}</option>)}</select></label>{selectedSession ? <><div className="ops-readonly-field"><span>Current focus / topic</span><strong>{selectedSession.focus_name ?? 'Belum dipilih mentee'}</strong></div><div className="ops-readonly-field"><span>Status</span><strong>{selectedStatus?.label}</strong></div></> : null}</div></section>
        {selectedSession ? <><section className="mentoring-form-section"><div className="mentoring-form-section__title"><UserRound aria-hidden="true" /><div><span>Mentor Assignment</span><h4>Mentor untuk sesi {selectedSession.session_number}</h4></div></div><div className="mentoring-form-grid"><label className="ops-field"><span>Eligible mentor</span><select value={mentorId} onChange={event => setMentorId(event.target.value)} disabled={!selectedSession.session_focus_id || selectedSession.status === 'completed'}><option value="">Pilih mentor</option>{mentors.map(mentor => <option value={mentor.mentor_id} key={mentor.mentor_id}>{mentor.mentor_name}</option>)}</select></label><div className="ops-readonly-field"><span>Mentor tier wajib</span><strong>{selectedSession.mentor_tier_name}</strong><small>Daftar mentor otomatis dibatasi ke tier paket.</small></div></div></section><section className="mentoring-form-section"><div className="mentoring-form-section__title"><CalendarDays aria-hidden="true" /><div><span>Schedule</span><h4>Jadwal sesi {selectedSession.session_number}</h4></div></div><div className="mentoring-form-grid"><label className="ops-field"><span>Date & start time</span><input type="datetime-local" value={startAt} onChange={event => setStartAt(event.target.value)} disabled={!selectedSession.session_focus_id || selectedSession.status === 'completed'} /></label><div className="ops-readonly-field"><span>Duration</span><strong>{durationLabel(selectedSession)}</strong><small>Durasi mengikuti entitlement paket.</small></div>{selectedSession.scheduled_start_at ? <div className="ops-readonly-field mentoring-form-grid__wide"><span>Current schedule</span><strong>{DATE_TIME.format(new Date(selectedSession.scheduled_start_at))}</strong></div> : null}</div></section><section className="mentoring-form-section"><div className="mentoring-form-section__title"><Clock3 aria-hidden="true" /><div><span>Status / Action</span><h4>{selectedStatus?.label}</h4></div></div><div className="mentoring-form-actions"><div><span>Session {selectedSession.session_number}/{selectedEnrollment.purchased_sessions}</span><strong>{selectedSession.focus_name ?? 'Menunggu fokus mentee'}</strong></div><div className="button-row"><button className="button button-primary" type="button" onClick={() => void schedule()} disabled={busy || !selectedSession.session_focus_id || selectedSession.status === 'completed'}>{selectedSession.status === 'scheduled' ? 'Simpan perubahan jadwal' : 'Jadwalkan sesi'}</button>{selectedSession.status === 'scheduled' ? <button className="button button-outline" type="button" onClick={() => void complete()} disabled={busy}><CheckCircle2 aria-hidden="true" size={16} />Tandai selesai</button> : null}</div></div></section></> : <p className="muted">Belum ada sesi pada paket ini.</p>}
        {message ? <p className="ops-feedback ops-feedback--success" role="status">{message}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}
      </div> : null}
    </dialog>
  </div>
}
