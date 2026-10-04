'use client'

import { AlertTriangle, Ban, CalendarDays, CheckCircle2, Link2, Pencil, Plus, RefreshCw, RotateCcw, Save, Search, Settings2, ShieldAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { CopyTextButton } from '@/components/dashboard/copy-text-button'
import { MentoringCompetitionEditor } from '@/components/mentoring/mentoring-competition-editor'
import { MentoringConfirmDialog } from '@/components/mentoring/mentoring-confirm-dialog'
import { MentoringSessionPreferences } from '@/components/mentoring/mentoring-session-preferences'
import { SearchableMentorPicker } from '@/components/mentoring/searchable-mentor-picker'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { createClient } from '@/lib/supabase/client'
import { intensiveStageLabels, type IntensiveProgramStage, type IntensiveSessionView } from '@/lib/intensive-mentoring/types'
import { AdminScheduleDialog } from './admin-schedule-dialog'
import { AdminSessionOperations, type AdminMeetingState } from './private-mentoring-session-operations'
import { TablePagination } from './table-pagination'

type AddOn = { entitlementId: string | null; name: string; code: string; status?: string; createdAt?: string; source?: 'attached' | 'bundle' | 'custom_offer'; supportType?: 'add_on' | 'benefit' }
type AdminSession = IntensiveSessionView & { creationReason?: string | null }
type Engagement = {
  engagement_id: string; mentee_id: string; mentee_name: string | null; mentee_email: string; base_entitlement_id: string
  base_kind: 'package' | 'bundle' | 'custom_offer'; program_name: string; status: string; baseline_sessions_per_month: number | null
  primary_mentor_id: string | null; primary_mentor_name: string | null; program_stage: IntensiveProgramStage
  current_activity: string | null; progress_summary: string | null; created_at: string
  add_ons: AddOn[]; sessions: AdminSession[]; unassigned_add_ons: AddOn[]
}
type Mentor = { id: string; name: string }
type CreatedSession = {
  id: string; session_number: number; duration_minutes: number; status: AdminSession['status']
  mentor_id: string | null; creation_source: string; creation_reason: string | null
}
type RpcClient = { rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }> }
type Confirmation = { action: 'complete' | 'reopen' | 'cancel'; session: AdminSession }
const STAGES = Object.entries(intensiveStageLabels) as [IntensiveProgramStage, string][]
const PAGE_SIZE = 10
const STATUS_LABELS: Record<string, string> = { active: 'Aktif', completed: 'Selesai', cancelled: 'Dibatalkan', scheduled: 'Terjadwal', awaiting_focus: 'Menunggu preferensi', awaiting_scheduling: 'Belum dijadwalkan' }
const typeLabel = (kind: Engagement['base_kind']) => kind === 'bundle' ? 'Bundle' : kind === 'custom_offer' ? 'Custom' : 'Package'
const statusLabel = (status: string) => STATUS_LABELS[status] || status.replaceAll('_', ' ')
const statusClass = (status: string) => status === 'completed' ? 'ops-status--success' : status === 'cancelled' ? 'ops-status--danger' : status === 'scheduled' ? 'mentoring-status--scheduled' : status === 'active' ? 'ops-status--info' : 'ops-status--warning'
const reviewLabel = (status: AdminSession['topicStatus']) => status === 'confirmed' ? 'Sudah ditinjau' : status === 'pending_review' ? 'Menunggu review' : 'Belum diajukan'
const reviewClass = (status: AdminSession['topicStatus']) => status === 'confirmed' ? 'ops-status--success' : status === 'pending_review' ? 'ops-status--warning' : 'ops-status--neutral'
const sessionHeadline = (session: AdminSession) => session.resolvedTopic || session.focusName || session.menteeTopicRequest || 'Preferensi belum ditentukan'

function scheduleLabel(item: AdminSession) {
  if (!item.scheduledStartAt) return 'Belum dijadwalkan'
  const zone = 'Asia/Jakarta'
  const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: zone }).format(new Date(item.scheduledStartAt))
  const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone })
  const start = time.format(new Date(item.scheduledStartAt)).replace('.', ':')
  const end = item.scheduledEndAt ? time.format(new Date(item.scheduledEndAt)).replace('.', ':') : null
  return date + ' · ' + start + (end ? '–' + end : '') + ' WIB'
}

function selectInitialSession(sessions: AdminSession[], preferredId?: string | null) {
  if (preferredId && sessions.some(session => session.sessionId === preferredId)) return preferredId
  const actionable = sessions.filter(session => session.status !== 'completed' && session.status !== 'cancelled')
  const review = actionable.find(session => session.topicStatus === 'pending_review')
  if (review) return review.sessionId
  const scheduling = actionable.find(session => session.topicStatus === 'confirmed' && session.status === 'awaiting_scheduling')
  if (scheduling) return scheduling.sessionId
  const now = Date.now()
  const upcoming = actionable.filter(session => session.status === 'scheduled' && session.scheduledStartAt && new Date(session.scheduledStartAt).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledStartAt || 0).getTime() - new Date(b.scheduledStartAt || 0).getTime())[0]
  if (upcoming) return upcoming.sessionId
  const latestScheduled = [...actionable].filter(session => session.scheduledStartAt)
    .sort((a, b) => new Date(b.scheduledStartAt || 0).getTime() - new Date(a.scheduledStartAt || 0).getTime())[0]
  return latestScheduled?.sessionId ?? actionable.at(-1)?.sessionId ?? sessions.at(-1)?.sessionId ?? null
}

export function IntensiveMentoringSessionManagement({ focusSessionId, focusEngagementId }: { focusSessionId?: string | null; focusEngagementId?: string | null } = {}) {
  const [supabase] = useState(() => createClient())
  const rpc = supabase as unknown as RpcClient
  const [rows, setRows] = useState<Engagement[]>([])
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(0)
  const [editingDedicatedMentor, setEditingDedicatedMentor] = useState(false)
  const [editingProgramProgress, setEditingProgramProgress] = useState(false)
  const [editingSessionMentor, setEditingSessionMentor] = useState(false)
  const [addingSession, setAddingSession] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [preferenceEditRequest, setPreferenceEditRequest] = useState(0)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [meetingState, setMeetingState] = useState<AdminMeetingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [primaryMentor, setPrimaryMentor] = useState('')
  const [mentorReason, setMentorReason] = useState('')
  const [stage, setStage] = useState<IntensiveProgramStage>('goal_setting')
  const [currentActivity, setCurrentActivity] = useState('')
  const [progress, setProgress] = useState('')
  const [duration, setDuration] = useState('')
  const [sessionReason, setSessionReason] = useState('')
  const [sessionMentor, setSessionMentor] = useState('')
  const [sessionMentorReason, setSessionMentorReason] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const handledTargetRef = useRef<string | null>(null)
  const loadSequenceRef = useRef(0)
  const selected = rows.find(row => row.engagement_id === selectedId) ?? null
  const sessions = useMemo(() => [...(selected?.sessions ?? [])].sort((a, b) => a.sessionNumber - b.sessionNumber), [selected])
  const session = sessions.find(item => item.sessionId === activeSessionId) ?? null
  const closed = session?.status === 'completed' || session?.status === 'cancelled'
  const canSchedule = session?.topicStatus === 'confirmed' && (session.status === 'awaiting_scheduling' || session.status === 'scheduled')
  const calendarIssue = session?.googleSyncStatus === 'failed' || meetingState?.calendarSyncStatus === 'failed'
  const filteredRows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('id-ID')
    return rows.filter(row => (!statusFilter || row.status === statusFilter) && (!typeFilter || row.base_kind === typeFilter) &&
      (!search || [row.mentee_name, row.mentee_email, row.program_name, row.engagement_id, ...row.sessions.map(item => item.sessionId)]
        .some(value => value?.toLocaleLowerCase('id-ID').includes(search))))
  }, [query, rows, statusFilter, typeFilter])
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filteredRows.length / PAGE_SIZE) - 1))
  const visibleRows = filteredRows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  const load = useCallback(async () => {
    const sequence = ++loadSequenceRef.current
    try {
      const [engagements, mentorRows] = await Promise.all([
        rpc.rpc<Engagement[]>('list_admin_intensive_mentoring_engagements'),
        supabase.from('mentor_profiles').select('user_id,is_active').eq('is_active', true),
      ])
      if (sequence !== loadSequenceRef.current) return
      if (engagements.error) setError(engagements.error.message)
      else setRows(engagements.data ?? [])
      if (!mentorRows.error) {
        if (!mentorRows.data?.length) setMentors([])
        else {
          const profiles = await supabase.from('profiles').select('id,first_name,last_name,username').in('id', mentorRows.data.map(row => row.user_id))
          if (sequence !== loadSequenceRef.current) return
          if (!profiles.error) setMentors((profiles.data ?? []).map(row => ({ id: row.id, name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.username || 'Mentor Strativate' })).sort((a, b) => a.name.localeCompare(b.name, 'id-ID')))
        }
      }
    } catch {
      if (sequence === loadSequenceRef.current) setError('Data Intensive Mentoring belum dapat dimuat. Coba muat ulang.')
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false)
    }
  }, [rpc, supabase])

  useEffect(() => { void load() }, [load])
  useOperationalInvalidation(['mentoring', 'provider', 'calendar'], () => { void load() })
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selected && !dialog.open) dialog.showModal()
    if (!selected && dialog.open) dialog.close()
  }, [selected])
  useEffect(() => {
    setActiveSessionId(current => current && sessions.some(item => item.sessionId === current) ? current : selectInitialSession(sessions))
  }, [sessions])
  useEffect(() => { setMeetingState(null); setEditingSessionMentor(false) }, [activeSessionId])
  useEffect(() => {
    if (!activeSessionId) return
    const frame = requestAnimationFrame(() => document.getElementById('intensive-session-tab-' + activeSessionId)?.scrollIntoView({ block: 'nearest' }))
    return () => cancelAnimationFrame(frame)
  }, [activeSessionId])

  const openWorkspace = useCallback((row: Engagement, preferredSessionId?: string | null) => {
    setSelectedId(row.engagement_id)
    setActiveSessionId(selectInitialSession([...row.sessions].sort((a, b) => a.sessionNumber - b.sessionNumber), preferredSessionId))
    setEditingDedicatedMentor(false); setEditingProgramProgress(false); setEditingSessionMentor(false)
    setSupportOpen(false); setMeetingState(null); setError(''); setMessage('')
  }, [])
  const focusTarget = focusSessionId ?? focusEngagementId
  useEffect(() => {
    if (!focusTarget || loading || handledTargetRef.current === focusTarget) return
    const row = rows.find(item => focusSessionId ? item.sessions.some(item => item.sessionId === focusSessionId) : item.engagement_id === focusEngagementId)
    if (!row) return
    handledTargetRef.current = focusTarget
    openWorkspace(row, focusSessionId)
  }, [focusTarget, focusSessionId, focusEngagementId, loading, openWorkspace, rows])

  function closeWorkspace() {
    if (busy) return
    setSelectedId(null); setActiveSessionId(null); setEditingDedicatedMentor(false); setEditingProgramProgress(false)
    setEditingSessionMentor(false); setAddingSession(false); setConfirmation(null); setScheduleId(null)
  }
  async function run<T = unknown>(key: string, name: string, args: Record<string, unknown>, success: string) {
    setBusy(key); setError(''); setMessage('')
    try {
      const result = await rpc.rpc<T>(name, args)
      if (result.error) { setError(result.error.message); return null }
      setMessage(success)
      await load()
      return { data: result.data }
    } catch {
      setError('Perubahan belum dapat disimpan. Coba lagi.')
      return null
    } finally { setBusy('') }
  }
  async function savePrimary() {
    if (!selected || !primaryMentor) return
    const result = await run('primary', 'admin_set_intensive_primary_mentor', { p_engagement_id: selected.engagement_id, p_mentor_id: primaryMentor, p_reason: mentorReason.trim() || null }, 'Dedicated Mentor diperbarui.')
    if (result) setEditingDedicatedMentor(false)
  }
  async function saveStage() {
    if (!selected) return
    const result = await run('stage', 'admin_set_intensive_program_stage', { p_engagement_id: selected.engagement_id, p_stage: stage, p_progress_summary: progress.trim() || null, p_current_activity: currentActivity.trim() || null }, 'Progres program diperbarui.')
    if (result) setEditingProgramProgress(false)
  }
  async function addSession() {
    if (!selected) return
    const minutes = Number(duration)
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 240) { setError('Masukkan durasi sesi 15–240 menit.'); return }
    const result = await run<CreatedSession>('add', 'admin_add_intensive_mentoring_session', { p_engagement_id: selected.engagement_id, p_duration_minutes: minutes, p_reason: sessionReason.trim() || null }, 'Sesi ditambahkan tanpa mengubah order atau invoice.')
    if (result) {
      setAddingSession(false); setDuration(''); setSessionReason('')
      if (result.data) {
        const created = result.data
        const newSession: AdminSession = {
          sessionId: created.id, sessionNumber: created.session_number, durationMinutes: created.duration_minutes, status: created.status,
          focusId: null, focusName: null, menteeTopicRequest: null, topicStatus: 'needs_input', resolvedTopic: null,
          mentorId: created.mentor_id, mentorName: mentors.find(mentor => mentor.id === created.mentor_id)?.name ?? selected.primary_mentor_name,
          scheduledStartAt: null, scheduledEndAt: null, meetingUrl: null, googleSyncStatus: 'pending',
          creationSource: created.creation_source, creationReason: created.creation_reason,
        }
        // Keep the new session visible even if the follow-up read is temporarily unavailable.
        setRows(current => current.map(row => row.engagement_id !== selected.engagement_id || row.sessions.some(item => item.sessionId === created.id) ? row : {
          ...row, sessions: [...row.sessions, newSession],
        }))
        setActiveSessionId(created.id)
      }
    }
  }
  async function attachAddOn(entitlementId: string) {
    if (!selected) return
    await run('addon:' + entitlementId, 'admin_attach_intensive_add_on', { p_entitlement_id: entitlementId, p_engagement_id: selected.engagement_id, p_note: 'Admin reconciliation from Intensive Mentoring operations.' }, 'Add-on ditautkan ke engagement.')
  }
  async function assignSessionMentor() {
    if (!session || !sessionMentor || closed) return
    const result = await run('mentor', 'admin_assign_intensive_session_mentor', { p_session_id: session.sessionId, p_mentor_id: sessionMentor, p_reason: sessionMentorReason.trim() || null }, 'Mentor sesi diperbarui dan tercatat di audit.')
    if (result) setEditingSessionMentor(false)
  }
  async function confirmLifecycle() {
    if (!confirmation) return
    const target = confirmation.session
    if (confirmation.action !== 'cancel') {
      const result = await run(confirmation.action, 'admin_set_intensive_session_status', { p_session_id: target.sessionId, p_status: confirmation.action === 'complete' ? 'completed' : 'scheduled' }, confirmation.action === 'complete' ? 'Sesi ditandai selesai.' : 'Tanda selesai dibatalkan; sesi kembali terjadwal.')
      if (result) setConfirmation(null)
      return
    }
    if (target.status === 'completed' || target.status === 'cancelled') return
    setBusy('cancel'); setError(''); setMessage('')
    try {
      const response = await fetch('/api/admin/intensive-mentoring/sessions/' + target.sessionId + '/cancel', { method: 'POST' })
      const body = await response.json() as { error?: string; sync?: { status?: string } }
      if (!response.ok) throw new Error(body.error || 'Sesi belum dapat dibatalkan.')
      setConfirmation(null)
      setMessage(body.sync?.status === 'failed' ? 'Sesi dibatalkan dan Zoom room dilepas. Calendar perlu disinkronkan ulang.' : 'Sesi dibatalkan, Zoom room dilepas, dan Google Calendar diperbarui.')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sesi belum dapat dibatalkan.') }
    finally { setBusy('') }
  }
  async function retryCancellation() {
    if (!session) return
    setBusy('sync'); setError(''); setMessage('')
    try {
      const response = await fetch('/api/admin/intensive-mentoring/sessions/' + session.sessionId + '/sync', { method: 'POST' })
      const body = await response.json() as { error?: string; status?: string }
      if (!response.ok) throw new Error(body.error || 'Sinkronisasi belum berhasil.')
      setMessage(body.status === 'failed' ? 'Google Calendar masih perlu perhatian.' : 'Pembatalan Calendar sudah disinkronkan.')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sinkronisasi belum berhasil.') }
    finally { setBusy('') }
  }
  const handleMeetingState = useCallback((next: AdminMeetingState | null) => {
    if (!next || next.sessionId === activeSessionId) setMeetingState(next)
  }, [activeSessionId])
  function navigateSession(event: KeyboardEvent<HTMLButtonElement>, sessionId: string) {
    if (busy || !sessions.length) return
    const index = sessions.findIndex(item => item.sessionId === sessionId)
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? sessions.length - 1 : event.key === 'ArrowDown' ? (index + 1) % sessions.length : event.key === 'ArrowUp' ? (index - 1 + sessions.length) % sessions.length : null
    if (nextIndex === null) return
    event.preventDefault()
    const next = sessions[nextIndex]
    setActiveSessionId(next.sessionId)
    requestAnimationFrame(() => document.getElementById('intensive-session-tab-' + next.sessionId)?.focus())
  }
  function startAddSession() { setDuration(''); setSessionReason(''); setError(''); setAddingSession(true) }

  if (loading) return <section className="role-card"><p className="muted">Memuat Intensive Mentoring…</p></section>
  return <div className="ops-page intensive-admin-operations">
    <div className="role-page-title intensive-operations-heading"><div><p className="kicker">Operasional · Intensive Mentoring</p><h2>Engagement &amp; session operations</h2><p>Kelola program, preferensi, mentor, dan jadwal dari workspace engagement.</p></div><button type="button" className="button button-outline button-compact" onClick={() => { setError(''); void load() }}><RefreshCw aria-hidden="true"/>Muat ulang</button></div>
    <div className="ops-filter-bar intensive-engagement-filters">
      <label className="ops-field ops-field--wide"><span>Cari engagement / Session ID</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15}/><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Nama, email, program, atau ID"/></div></label>
      <label className="ops-field"><span>Status</span><select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(0) }}><option value="">Semua status</option>{Array.from(new Set(rows.map(row => row.status))).sort().map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
      <label className="ops-field"><span>Tipe</span><select value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setPage(0) }}><option value="">Semua tipe</option><option value="package">Package</option><option value="bundle">Bundle</option><option value="custom_offer">Custom</option></select></label>
      <button type="button" className="button button-outline ops-reset-action" onClick={() => { setQuery(''); setStatusFilter(''); setTypeFilter(''); setPage(0) }}><RotateCcw aria-hidden="true"/>Reset</button>
    </div>
    {!selected && error ? <p className="form-error" role="alert">{error}</p> : null}
    <section className="role-card ops-table-section intensive-engagement-section">
      <div className="ops-section-heading"><div><p className="kicker">Engagement operasional</p><h3>Paid Intensive Engagements</h3></div><span>{filteredRows.length} data</span></div>
      <div className="ops-table-wrap"><table className="ops-table intensive-engagement-table"><thead><tr><th>Mentee</th><th>Program</th><th>Tipe</th><th>Baseline</th><th>Sesi</th><th>Dedicated Mentor</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.engagement_id}>
        <td data-label="Mentee"><strong>{row.mentee_name || row.mentee_email}</strong><small className="ops-table-secondary">{row.mentee_email}</small></td>
        <td data-label="Program"><strong>{row.program_name}</strong></td><td data-label="Tipe">{typeLabel(row.base_kind)}</td>
        <td data-label="Baseline">{row.baseline_sessions_per_month ? row.baseline_sessions_per_month + ' sesi/bln' : 'Fleksibel'}</td><td data-label="Sesi">{row.sessions.length}</td>
        <td data-label="Dedicated Mentor">{row.primary_mentor_name || 'Belum ditetapkan'}</td><td data-label="Status"><span className={'ops-status ' + statusClass(row.status)}>{statusLabel(row.status)}</span></td>
        <td data-label="Aksi"><button type="button" className="button button-outline button-compact" onClick={() => openWorkspace(row)}><Settings2 aria-hidden="true"/>Kelola</button></td>
      </tr>)}</tbody></table>{!visibleRows.length ? <p className="calendar-empty">{rows.length ? 'Tidak ada engagement yang cocok.' : 'Belum ada engagement Intensive Mentoring berbayar.'}</p> : null}</div>
      <TablePagination page={currentPage} pageSize={PAGE_SIZE} totalItems={filteredRows.length} onPageChange={setPage} label="Pagination engagement Intensive Mentoring"/>
    </section>

    <dialog ref={dialogRef} className="ops-dialog mentoring-session-workspace-dialog intensive-workspace-dialog" aria-labelledby="intensive-workspace-title" onCancel={event => { event.preventDefault(); closeWorkspace() }}>
      {selected ? <div className="mentoring-workspace-shell">
        <header className="ops-dialog__header mentoring-workspace-modal-head"><div><p className="kicker">Kelola engagement</p><h3 id="intensive-workspace-title">{selected.mentee_name || selected.mentee_email}</h3><div className="intensive-workspace-context"><p>{selected.program_name} · Intensive Mentoring</p><span className={'ops-status ' + statusClass(selected.status)}>{statusLabel(selected.status)}</span></div></div><button type="button" className="ops-icon-button" disabled={Boolean(busy)} onClick={closeWorkspace} aria-label="Tutup workspace engagement"><X aria-hidden="true"/></button></header>
        <section className="mentoring-enrollment-summary-panel intensive-workspace-program" aria-label="Ringkasan program">
          <div className="mentoring-enrollment-summary-grid intensive-program-summary-grid">
            <div><span>Program</span><strong>{selected.program_name}</strong><small>{typeLabel(selected.base_kind)}</small></div>
            <div><span>Baseline</span><strong>{selected.baseline_sessions_per_month ? selected.baseline_sessions_per_month + ' sesi/bulan' : 'Fleksibel'}</strong></div>
            <div><span>Dedicated Mentor</span><div className="mentoring-summary-inline-value"><strong>{selected.primary_mentor_name || 'Belum ditetapkan'}</strong><button type="button" className="mentoring-summary-icon-action" disabled={Boolean(busy)} onClick={() => { setPrimaryMentor(selected.primary_mentor_id ?? ''); setMentorReason(''); setEditingDedicatedMentor(value => !value) }} aria-label="Edit Dedicated Mentor"><Pencil aria-hidden="true"/></button></div></div>
            <div><span>Tahap Program</span><strong>{intensiveStageLabels[selected.program_stage]}</strong></div>
            <MentoringCompetitionEditor key={selected.engagement_id} kind="intensive" parentId={selected.engagement_id} compact summary/>
          </div>
          <div className="intensive-program-actions"><button type="button" className="button button-outline" disabled={Boolean(busy)} aria-expanded={editingProgramProgress} aria-controls="intensive-program-editor" onClick={() => { setStage(selected.program_stage); setCurrentActivity(selected.current_activity ?? ''); setProgress(selected.progress_summary ?? ''); setEditingProgramProgress(value => !value) }}><Settings2 aria-hidden="true"/>Kelola program</button>
            {selected.unassigned_add_ons.length ? <button type="button" className="intensive-support-warning" onClick={() => setSupportOpen(true)}><ShieldAlert aria-hidden="true"/>{selected.unassigned_add_ons.length} add-on perlu ditautkan</button> : null}
          </div>
          {editingDedicatedMentor ? <div className="mentoring-summary-mentor-editor intensive-inline-editor">
            <SearchableMentorPicker mentors={mentors} value={primaryMentor} onChange={setPrimaryMentor} label="Dedicated Mentor" selectedLabel={primaryMentor === selected.primary_mentor_id ? selected.primary_mentor_name : null} disabled={Boolean(busy)}/>
            <label className="ops-field"><span>Alasan perubahan (opsional)</span><input value={mentorReason} onChange={event => setMentorReason(event.target.value)} placeholder="Konteks perubahan mentor"/></label>
            <div className="button-row"><button type="button" className="button button-primary" disabled={Boolean(busy) || !primaryMentor || primaryMentor === selected.primary_mentor_id} onClick={() => void savePrimary()}><Save aria-hidden="true"/>Simpan mentor</button><button type="button" className="button button-outline" disabled={Boolean(busy)} onClick={() => setEditingDedicatedMentor(false)}><X aria-hidden="true"/>Batal</button></div>
          </div> : null}
          {editingProgramProgress ? <div id="intensive-program-editor" className="intensive-inline-editor intensive-program-editor">
            <label className="ops-field"><span>Tahap Program</span><select value={stage} onChange={event => setStage(event.target.value as IntensiveProgramStage)}>{STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="ops-field"><span>Aktivitas saat ini (opsional)</span><input maxLength={500} value={currentActivity} onChange={event => setCurrentActivity(event.target.value)} placeholder="Aktivitas program saat ini"/></label>
            <label className="ops-field intensive-program-editor__progress"><span>Ringkasan progres (opsional)</span><textarea rows={3} maxLength={3000} value={progress} onChange={event => setProgress(event.target.value)}/></label>
            <div className="button-row"><button type="button" className="button button-primary" disabled={Boolean(busy) || (stage === selected.program_stage && currentActivity.trim() === (selected.current_activity ?? '') && progress.trim() === (selected.progress_summary ?? ''))} onClick={() => void saveStage()}><Save aria-hidden="true"/>Simpan progres</button><button type="button" className="button button-outline" disabled={Boolean(busy)} onClick={() => setEditingProgramProgress(false)}><X aria-hidden="true"/>Batal</button></div>
          </div> : null}
          <details className="mentoring-audit-details intensive-program-progress"><summary>Aktivitas &amp; progres</summary><dl><div><dt>Aktivitas saat ini</dt><dd>{selected.current_activity || 'Belum dicatat'}</dd></div><div><dt>Ringkasan progres</dt><dd>{selected.progress_summary || 'Belum ada ringkasan'}</dd></div></dl></details>
          <details className="mentoring-audit-details intensive-program-support" open={supportOpen} onToggle={event => setSupportOpen(event.currentTarget.open)}><summary>Support &amp; benefit{selected.unassigned_add_ons.length ? <span className="ops-status ops-status--warning">{selected.unassigned_add_ons.length} perlu ditautkan</span> : null}</summary>
            <div className="intensive-program-support__body"><h4>Add-on terpasang</h4><div className="intensive-config-chips">{selected.add_ons.filter(item => item.supportType !== 'benefit').length ? selected.add_ons.filter(item => item.supportType !== 'benefit').map(addon => <span className="intensive-addon-chip" key={addon.entitlementId ?? addon.code + addon.name}>{addon.name}</span>) : <p className="muted">Belum ada add-on terpasang.</p>}</div>
              {selected.add_ons.some(item => item.supportType === 'benefit') ? <><h4>Benefit custom</h4><div className="intensive-config-chips">{selected.add_ons.filter(item => item.supportType === 'benefit').map(addon => <span className="intensive-addon-chip" key={addon.code + addon.name}>{addon.name}</span>)}</div></> : null}
              {selected.unassigned_add_ons.length ? <div className="intensive-unassigned-addons"><ShieldAlert aria-hidden="true"/><div><strong>Add-on belum terasosiasi</strong><p>Tautkan hanya jika add-on memang milik engagement ini.</p><div className="button-row">{selected.unassigned_add_ons.map(addon => <button type="button" className="button button-outline" disabled={Boolean(busy) || !addon.entitlementId} onClick={() => { if (addon.entitlementId) void attachAddOn(addon.entitlementId) }} key={addon.entitlementId ?? addon.code}><Link2 aria-hidden="true"/>Tautkan {addon.name}</button>)}</div></div></div> : null}
            </div>
          </details>
          {error ? <p className="form-error mentoring-workspace-feedback" role="alert">{error}</p> : null}
          {message ? <p className="form-success mentoring-workspace-feedback" role="status">{message}</p> : null}
        </section>

        <div className="mentoring-workspace-main">
          <aside className="mentoring-session-navigator" aria-label="Navigasi sesi Intensive">
            <div className="mentoring-session-navigator__head"><div className="intensive-navigator-count"><strong>Sesi</strong><span>{sessions.length}</span></div><button type="button" className="button button-primary intensive-add-session-button" disabled={Boolean(busy) || selected.status !== 'active'} onClick={startAddSession}><Plus aria-hidden="true"/>Tambah sesi</button></div>
            <div className="mentoring-session-navigator__list" role="tablist" aria-orientation="vertical">{sessions.map(item => <button key={item.sessionId} id={'intensive-session-tab-' + item.sessionId} type="button" role="tab" tabIndex={item.sessionId === activeSessionId ? 0 : -1} aria-selected={item.sessionId === activeSessionId} aria-controls="intensive-selected-session-panel" disabled={Boolean(busy)} className={'mentoring-session-nav-item' + (item.sessionId === activeSessionId ? ' is-active' : '') + (item.status === 'completed' || item.status === 'cancelled' ? ' is-muted' : '') + (item.status === 'cancelled' ? ' is-cancelled' : '')} onKeyDown={event => navigateSession(event, item.sessionId)} onClick={() => setActiveSessionId(item.sessionId)}>
              <span className="mentoring-session-nav-item__title"><strong>Sesi {item.sessionNumber}</strong>{item.googleSyncStatus === 'failed' ? <AlertTriangle aria-label="Calendar perlu perhatian"/> : null}</span>
              <span className="mentoring-session-nav-item__badges"><span className={'ops-status ' + reviewClass(item.topicStatus)}>{reviewLabel(item.topicStatus)}</span><span className={'ops-status ' + statusClass(item.status)}>{statusLabel(item.status)}</span></span>
              <small>{item.scheduledStartAt ? scheduleLabel(item) : sessionHeadline(item)}</small>
            </button>)}</div>
          </aside>
          <div className="mentoring-session-mobile-select intensive-session-mobile-control"><label className="ops-field"><span>Pilih sesi · {sessions.length}</span><select disabled={Boolean(busy) || !sessions.length} value={session?.sessionId ?? ''} onChange={event => setActiveSessionId(event.target.value)}>{!sessions.length ? <option value="">Belum ada sesi</option> : null}{sessions.map(item => <option key={item.sessionId} value={item.sessionId}>Sesi {item.sessionNumber} · {reviewLabel(item.topicStatus)} · {statusLabel(item.status)}</option>)}</select></label><button type="button" className="button button-primary" disabled={Boolean(busy) || selected.status !== 'active'} onClick={startAddSession}><Plus aria-hidden="true"/>Tambah sesi</button></div>
          <section id="intensive-selected-session-panel" role="tabpanel" aria-labelledby={session ? 'intensive-session-tab-' + session.sessionId : undefined} className={'mentoring-selected-session-workspace' + (session?.status === 'completed' ? ' is-completed' : '') + (session?.status === 'cancelled' ? ' is-cancelled' : '')}>
            {session ? <div className="mentoring-selected-session-inner">
              <div className="mentoring-selected-session-sticky">
                <div className="mentoring-selected-session-header"><div className="mentoring-selected-session-header__copy"><p className="kicker">Sesi {session.sessionNumber} · {session.durationMinutes} menit</p><h3>{sessionHeadline(session)}</h3><p>{session.mentorName || selected.primary_mentor_name || 'Mentor belum ditetapkan'} · {scheduleLabel(session)}</p></div><div className="mentoring-selected-session-header__badges"><span className={'ops-status ' + reviewClass(session.topicStatus)}>{reviewLabel(session.topicStatus)}</span><span className={'ops-status ' + statusClass(session.status)}>{statusLabel(session.status)}</span>{meetingState?.manualMeetingUrl ? <span className="ops-status mentoring-manual-override-badge"><Pencil aria-hidden="true"/>Manual override</span> : null}</div></div>
                <div className="mentoring-selected-session-meta">{meetingState?.assignedZoomRoomName ? <span className="mentoring-session-meta-chip">{meetingState.assignedZoomRoomName}</span> : null}{calendarIssue ? <span className="mentoring-session-meta-chip is-warning"><AlertTriangle aria-hidden="true"/>Calendar perlu perhatian</span> : null}<div className="mentoring-session-id-meta"><span>Session ID</span><code>{session.sessionId}</code><CopyTextButton value={session.sessionId} label="Salin ID" copiedLabel="ID disalin"/></div></div>
                <div className="mentoring-session-action-bar"><div className="mentoring-session-action-bar__primary">
                  {!closed ? <button type="button" className="button button-outline" disabled={Boolean(busy)} onClick={() => setPreferenceEditRequest(value => value + 1)}><Pencil aria-hidden="true"/>{session.topicStatus === 'pending_review' ? 'Review preferensi' : 'Edit preferensi'}</button> : null}
                  {canSchedule ? <button type="button" className={'button ' + (session.status === 'scheduled' ? 'button-outline' : 'button-primary')} disabled={Boolean(busy)} onClick={() => setScheduleId(session.sessionId)}><CalendarDays aria-hidden="true"/>{session.status === 'scheduled' ? 'Ubah jadwal' : 'Jadwalkan sesi'}</button> : null}
                  {session.status === 'scheduled' ? <button type="button" className="button button-primary" disabled={Boolean(busy)} onClick={() => { setError(''); setConfirmation({ action: 'complete', session }) }}><CheckCircle2 aria-hidden="true"/>Tandai selesai</button> : null}
                  {session.status === 'completed' ? <button type="button" className="button button-outline" disabled={Boolean(busy)} onClick={() => { setError(''); setConfirmation({ action: 'reopen', session }) }}><RotateCcw aria-hidden="true"/>Batalkan tanda selesai</button> : null}
                  {session.status === 'cancelled' && calendarIssue ? <button type="button" className="button button-outline" disabled={Boolean(busy)} onClick={() => void retryCancellation()}><RefreshCw aria-hidden="true"/>Sinkronkan pembatalan</button> : null}
                </div>{!closed ? <button type="button" className="button button-outline mentoring-session-cancel-trigger" disabled={Boolean(busy)} onClick={() => { setError(''); setConfirmation({ action: 'cancel', session }) }}><Ban aria-hidden="true"/>Batalkan sesi</button> : null}</div>
              </div>
              <div className="mentoring-selected-session-scroll">
                <MentoringSessionPreferences key={session.sessionId+'-'+session.status} kind="intensive" sessionId={session.sessionId} role="admin" title="Preferensi Sesi" showCompetitionContext={false} showReviewStatus={false} auditMode="request-only" hideEditButton editRequestKey={preferenceEditRequest} onChanged={load}/>
                <section className="intensive-session-mentor"><div className="intensive-session-mentor__head"><div><span>Mentor sesi</span><strong>{session.mentorName || selected.primary_mentor_name || 'Belum ditetapkan'}</strong></div>{!closed && !editingSessionMentor ? <button type="button" className="button button-outline" disabled={Boolean(busy)} onClick={() => { setSessionMentor(session.mentorId ?? selected.primary_mentor_id ?? ''); setSessionMentorReason(''); setEditingSessionMentor(true) }}><Pencil aria-hidden="true"/>Edit mentor</button> : null}</div>
                  {editingSessionMentor && !closed ? <div className="ops-form-stack"><SearchableMentorPicker mentors={mentors} value={sessionMentor} onChange={setSessionMentor} label="Mentor sesi" selectedLabel={sessionMentor === (session.mentorId ?? selected.primary_mentor_id) ? session.mentorName || selected.primary_mentor_name : null} disabled={Boolean(busy)}/><label className="ops-field"><span>Alasan override (opsional)</span><input value={sessionMentorReason} onChange={event => setSessionMentorReason(event.target.value)} placeholder="Konteks perubahan mentor sesi"/></label><div className="button-row"><button type="button" className="button button-primary" disabled={Boolean(busy) || !sessionMentor || sessionMentor === (session.mentorId ?? selected.primary_mentor_id)} onClick={() => void assignSessionMentor()}><Save aria-hidden="true"/>Simpan mentor sesi</button><button type="button" className="button button-outline" disabled={Boolean(busy)} onClick={() => setEditingSessionMentor(false)}><X aria-hidden="true"/>Batal</button></div></div> : null}
                </section>
                <AdminSessionOperations key={'operations-' + session.sessionId} mentoringKind="intensive" sessionId={session.sessionId} status={session.status} menteeName={selected.mentee_name || selected.mentee_email} sessionNumber={session.sessionNumber} mentorName={session.mentorName || selected.primary_mentor_name} scheduledStartAt={session.scheduledStartAt} onChanged={load} showSessionReference={false} showCompletionActions={false} showContextSummary={false} onStateChange={handleMeetingState}/>
                <details className="mentoring-audit-details"><summary>Riwayat &amp; detail sesi</summary><dl><div><dt>Sumber sesi</dt><dd>{session.creationSource === 'admin_added' ? 'Ditambahkan admin' : 'Baseline program'}</dd></div><div><dt>Catatan pembuatan</dt><dd>{session.creationReason || 'Tidak ada'}</dd></div><div><dt>Durasi</dt><dd>{session.durationMinutes} menit</dd></div><div><dt>Session ID</dt><dd><code>{session.sessionId}</code></dd></div></dl></details>
              </div>
            </div> : <div className="calendar-empty">Belum ada sesi. Tambahkan sesi dari navigasi program.</div>}
          </section>
        </div>
      </div> : null}
    </dialog>
    <AdminScheduleDialog sessionId={scheduleId} mentoringKind="intensive" onClose={() => setScheduleId(null)} onScheduled={() => { setScheduleId(null); void load() }}/>
    <MentoringConfirmDialog open={addingSession} title="Tambah sesi operasional" eyebrow="Intensive Mentoring" confirmLabel="Tambah sesi" cancelLabel="Batal" confirmIcon={<Plus aria-hidden="true"/>} busy={busy === 'add'} confirmDisabled={!duration} onClose={() => setAddingSession(false)} onConfirm={() => void addSession()}>
      <div className="ops-form-stack"><label className="ops-field"><span>Durasi sesi (menit)</span><input type="number" min={15} max={240} value={duration} onChange={event => setDuration(event.target.value)} autoFocus/><small>15–240 menit</small></label><label className="ops-field"><span>Alasan / catatan (opsional)</span><textarea rows={3} maxLength={3000} value={sessionReason} onChange={event => setSessionReason(event.target.value)}/></label><p>Baseline bukan batas sesi. Order dan invoice tetap.</p>{error ? <p className="form-error" role="alert">{error}</p> : null}</div>
    </MentoringConfirmDialog>
    <MentoringConfirmDialog open={Boolean(confirmation)} title={confirmation?.action === 'reopen' ? 'Batalkan tanda selesai sesi ' + confirmation.session.sessionNumber + '?' : (confirmation?.action === 'cancel' ? 'Batalkan sesi ' : 'Tandai sesi ') + (confirmation?.session.sessionNumber ?? '') + (confirmation?.action === 'complete' ? ' selesai?' : '?')}
      confirmLabel={confirmation?.action === 'cancel' ? 'Ya, batalkan sesi' : confirmation?.action === 'reopen' ? 'Ya, buka kembali' : 'Ya, tandai selesai'} confirmIcon={confirmation?.action === 'cancel' ? <Ban aria-hidden="true"/> : confirmation?.action === 'reopen' ? <RotateCcw aria-hidden="true"/> : <CheckCircle2 aria-hidden="true"/>} destructive={confirmation?.action === 'cancel'} busy={Boolean(busy)} onClose={() => setConfirmation(null)} onConfirm={() => void confirmLifecycle()}>
      <p>{confirmation?.action === 'cancel' ? 'Sesi dibatalkan, reservasi Zoom room dilepas, dan undangan Google Calendar terkait diperbarui atau dibatalkan.' : confirmation?.action === 'reopen' ? 'Sesi kembali terjadwal. Zoom room akan direservasi kembali sesuai ketersediaan dan perubahan dicatat di audit.' : 'Sesi masuk ke riwayat selesai dan tidak dapat diedit. Perubahan dicatat di audit.'}</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </MentoringConfirmDialog>
  </div>
}
