'use client'

import { ExternalLink, Eye, MessageCircle, Search, Trophy, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { TablePagination } from '@/components/admin/table-pagination'
import { CopyTextButton } from '@/components/dashboard/copy-text-button'
import { MentoringCompetitionEditor } from '@/components/mentoring/mentoring-competition-editor'
import { MentoringSessionPreferences } from '@/components/mentoring/mentoring-session-preferences'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { publicContact } from '@/lib/content/brand'
import { menteeReviewStatus, menteeSessionStatus } from '@/lib/mentoring-presentation'
import { createClient } from '@/lib/supabase/client'
import type { PrivateMentoringSessionFocusView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'
import styles from './mentee-mentoring.module.css'

type RpcClient = { rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }> }
type Competition = { enrollment_id: string; competition_category_id: string | null; competition_category_name: string | null; competition_name: string | null; competition_updated_at: string | null }
type SortMode = 'session' | 'schedule_asc' | 'schedule_desc'

function scheduleText(session: PrivateMentoringSessionView) {
  return session.scheduledStartAt
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: session.mentorTimezone || undefined }).format(new Date(session.scheduledStartAt))
    : 'Not scheduled'
}

function supportHref(session: PrivateMentoringSessionView) {
  const when = session.scheduledStartAt ? scheduleText(session) : 'the proposed schedule'
  return publicContact.whatsapp + '?text=' + encodeURIComponent(`Hello Strativate, I would like to discuss mentoring session ${session.sessionNumber} and ${when}. Session ID: ${session.sessionId}`)
}

export function PrivateMentoringSessions({ sessions, sessionFocuses: _sessionFocuses, focusSessionId, focusEnrollmentId }: {
  sessions: PrivateMentoringSessionView[]
  sessionFocuses: PrivateMentoringSessionFocusView[]
  focusSessionId?: string | null
  focusEnrollmentId?: string | null
}) {
  const supabase = useMemo(() => createClient(), [])
  const rpc = useMemo(() => supabase as unknown as RpcClient, [supabase])
  const [competitions, setCompetitions] = useState<Record<string, Competition>>({})
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [mentorFilter, setMentorFilter] = useState('all')
  const [focusFilter, setFocusFilter] = useState('all')
  const [sort, setSort] = useState<SortMode>('session')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const detailRef = useRef<HTMLDialogElement>(null)
  const groups = useMemo(() => {
    const grouped = new Map<string, PrivateMentoringSessionView[]>()
    sessions.forEach(session => {
      const group = grouped.get(session.enrollmentId)
      if (group) group.push(session)
      else grouped.set(session.enrollmentId, [session])
    })
    return [...grouped].map(([id, rows]) => ({ id, rows, purchased: rows[0]?.purchasedSessions ?? rows.length, completed: rows.filter(session => session.status === 'completed').length }))
  }, [sessions])
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(groups[0]?.id ?? '')
  const selectedGroup = groups.find(group => group.id === selectedEnrollmentId) ?? groups[0]
  const activeEnrollmentId = selectedGroup?.id ?? ''
  const selected = useMemo(() => selectedSessionId ? sessions.find(session => session.sessionId === selectedSessionId) ?? null : null, [selectedSessionId, sessions])

  useEffect(() => { if (selectedSessionId && !selected) setSelectedSessionId(null) }, [selected, selectedSessionId])

  const loadCompetitions = useCallback(async () => {
    const competition = await rpc.rpc<Competition[]>('list_my_private_mentoring_competitions')
    if (!competition.error) setCompetitions(Object.fromEntries((competition.data ?? []).map(row => [row.enrollment_id, row])))
  }, [rpc])
  useEffect(() => { void loadCompetitions() }, [loadCompetitions])
  useOperationalInvalidation(['mentoring'], () => { void loadCompetitions() })

  useEffect(() => {
    const dialog = detailRef.current
    if (!dialog) return
    if (selected && !dialog.open) dialog.showModal()
    if (!selected && dialog.open) dialog.close()
  }, [selected])

  useEffect(() => {
    if (!focusSessionId) return
    const match = sessions.find(session => session.sessionId === focusSessionId)
    if (match) { setSelectedEnrollmentId(match.enrollmentId); setSelectedSessionId(match.sessionId) }
  }, [focusSessionId, sessions])

  useEffect(() => {
    if (!focusEnrollmentId) return
    setSelectedEnrollmentId(focusEnrollmentId)
    requestAnimationFrame(() => document.getElementById('private-enrollment-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }, [focusEnrollmentId])

  const mentors = useMemo(() => [...new Set(sessions.map(s => s.mentorName || s.primaryMentorName).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, 'en-GB')), [sessions])
  const focusNames = useMemo(() => [...new Set(sessions.map(s => s.focusName).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, 'en-GB')), [sessions])
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('en-GB')
    const rows = sessions.filter(session => {
      if (session.enrollmentId !== activeEnrollmentId) return false
      const searchable = [session.sessionId, `session ${session.sessionNumber}`, session.resolvedTopic, session.menteeTopicRequest, session.focusName, session.mentorName, session.primaryMentorName].filter(Boolean).join(' ').toLocaleLowerCase('en-GB')
      return (!q || searchable.includes(q)) && (statusFilter === 'all' || session.status === statusFilter)
        && (mentorFilter === 'all' || session.mentorName === mentorFilter || session.primaryMentorName === mentorFilter)
        && (focusFilter === 'all' || session.focusName === focusFilter)
    })
    return [...rows].sort((a, b) => {
      if (sort === 'schedule_asc') return (a.scheduledStartAt ? new Date(a.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER) - (b.scheduledStartAt ? new Date(b.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER)
      if (sort === 'schedule_desc') return (b.scheduledStartAt ? new Date(b.scheduledStartAt).getTime() : Number.MIN_SAFE_INTEGER) - (a.scheduledStartAt ? new Date(a.scheduledStartAt).getTime() : Number.MIN_SAFE_INTEGER)
      return a.sessionNumber - b.sessionNumber
    })
  }, [activeEnrollmentId, focusFilter, mentorFilter, query, sessions, sort, statusFilter])
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1))
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)
  function resetPage() { setPage(0) }

  if (!sessions.length) return <section className={`workspace-card ${styles.empty}`}><h3>No Private Mentoring sessions yet</h3><p className="muted">Your sessions will appear once payment is verified.</p></section>

  return <div className={styles.workspace}>
    <ul className={styles.selectorRail} aria-label="Choose a Private Mentoring program">
      {groups.map(group => {
        const mentor = group.rows[0]?.primaryMentorName || group.rows[0]?.mentorName
        const competition = competitions[group.id]?.competition_name
        return <li key={group.id}><button type="button" className={styles.selectorCard} aria-pressed={activeEnrollmentId === group.id} onClick={() => { setSelectedEnrollmentId(group.id); resetPage() }} onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}>
          <span className={styles.programType}>Private Mentoring</span>
          <strong className={styles.programTitle}>{group.rows[0]?.mentorTierName || 'Private Mentoring'}</strong>
          <span className={styles.cardStats}><span><b>{group.purchased}</b> purchased</span><span><b>{group.completed}</b> completed</span><span><b>{Math.max(0, group.purchased - group.completed)}</b> remaining</span></span>
          <span className={styles.cardMeta}><Trophy aria-hidden="true" /><span>{competition || 'Competition not added'}</span></span>
          <span className={styles.cardMeta}><UserRound aria-hidden="true" /><span>{mentor || 'Mentor not assigned'}</span></span>
        </button></li>
      })}
    </ul>

    {selectedGroup ? <section className={`workspace-card ${styles.programDetail}`} id="private-enrollment-detail">
      <div className={styles.sectionHead}><h3>{selectedGroup.rows[0]?.mentorTierName || 'Private Mentoring'}</h3><div className={styles.inlineStats}><span>{selectedGroup.purchased} {selectedGroup.purchased === 1 ? 'session' : 'sessions'} purchased</span><span>{selectedGroup.completed} completed</span></div></div>
      <MentoringCompetitionEditor key={activeEnrollmentId} kind="private" parentId={activeEnrollmentId} language="en" compact />
    </section> : null}

    <section className={`workspace-card ${styles.sessionSection}`}>
      <div className={styles.toolbar}>
        <label className={`ops-field ${styles.searchField}`}><span>Search sessions</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15} /><input type="search" value={query} onChange={event => { setQuery(event.target.value); resetPage() }} placeholder="Session ID, topic, mentor, or session number" /></div></label>
        <label className="ops-field"><span>Status</span><select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); resetPage() }}><option value="all">All statuses</option><option value="awaiting_focus">Awaiting admin review</option><option value="awaiting_scheduling">Awaiting scheduling</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <label className="ops-field"><span>Mentor</span><select value={mentorFilter} onChange={event => { setMentorFilter(event.target.value); resetPage() }}><option value="all">All mentors</option>{mentors.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="ops-field"><span>Focus</span><select value={focusFilter} onChange={event => { setFocusFilter(event.target.value); resetPage() }}><option value="all">All focuses</option>{focusNames.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="ops-field"><span>Sort</span><select value={sort} onChange={event => { setSort(event.target.value as SortMode); resetPage() }}><option value="session">Session number</option><option value="schedule_asc">Nearest schedule</option><option value="schedule_desc">Latest schedule</option></select></label>
        <label className="ops-field"><span>Per page</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); resetPage() }}>{[5, 10, 20, 50].map(size => <option value={size} key={size}>{size}</option>)}</select></label>
      </div>
      <p className={styles.resultCount}>{filtered.length} {filtered.length === 1 ? 'session' : 'sessions'}</p>
      <div className={styles.tableWrap}><table className={styles.sessionTable} data-testid="mentee-mentoring-session-table">
        <caption className={styles.srOnly}>Private Mentoring sessions</caption>
        <colgroup><col className={styles.sessionCol} /><col className={styles.topicCol} /><col className={styles.mentorCol} /><col className={styles.scheduleCol} /><col className={styles.statusCol} /><col className={styles.zoomCol} /><col className={styles.detailCol} /></colgroup>
        <thead><tr><th scope="col">Session</th><th scope="col">Topic / Focus</th><th scope="col">Mentor</th><th scope="col">Schedule</th><th scope="col">Status</th><th scope="col">Zoom</th><th scope="col">Details</th></tr></thead>
        <tbody>{visible.length ? visible.map(session => { const status = menteeSessionStatus(session.status); return <tr key={session.sessionId}>
          <td data-label="Session"><strong>{session.sessionNumber} / {session.purchasedSessions}</strong></td>
          <td data-label="Topic / Focus"><div className={styles.cell}><strong>{session.resolvedTopic || session.focusName || 'Not selected'}</strong><small>{menteeReviewStatus(session.topicStatus)}</small></div></td>
          <td data-label="Mentor"><span>{session.mentorName || session.primaryMentorName || 'Mentor not assigned'}</span></td>
          <td data-label="Schedule"><span>{scheduleText(session)}</span></td>
          <td data-label="Status"><span className={`ops-status ops-status--${status.tone}`}>{status.label}</span></td>
          <td data-label="Zoom">{session.status === 'scheduled' && session.meetingUrl ? <a className={`button button-primary ${styles.tableAction}`} href={session.meetingUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open Zoom for session ${session.sessionNumber}`}><ExternalLink aria-hidden="true" />Zoom</a> : <span className="muted">Not available</span>}</td>
          <td data-label="Details"><button className={`button button-outline ${styles.tableAction}`} type="button" onClick={() => setSelectedSessionId(session.sessionId)} aria-label={`View details for session ${session.sessionNumber}`}><Eye aria-hidden="true" />Details</button></td>
        </tr> }) : <tr className={styles.emptyRow}><td colSpan={7}>No sessions match your filters.</td></tr>}</tbody>
      </table></div>
      <TablePagination page={safePage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} label="Private Mentoring session pages" language="en" />
    </section>

    <dialog ref={detailRef} className={`ops-dialog ${styles.detailDialog}`} aria-labelledby="mentee-session-detail-title" onCancel={event => { event.preventDefault(); setSelectedSessionId(null) }} onClose={() => setSelectedSessionId(null)}>
      {selected ? <div className={`ops-dialog__surface ${styles.dialogSurface}`}>
        <header className="ops-dialog__header"><div><p className={styles.dialogContext}>Private Mentoring</p><h2 id="mentee-session-detail-title">Session {selected.sessionNumber} / {selected.purchasedSessions}</h2></div><button type="button" className="ops-icon-button" onClick={() => setSelectedSessionId(null)} aria-label="Close session details"><X aria-hidden="true" /></button></header>
        <dl className={styles.detailGrid}>
          <div><dt>Package / tier</dt><dd>{selected.mentorTierName}</dd></div>
          <div><dt>Status</dt><dd>{menteeSessionStatus(selected.status).label}</dd></div>
          <div><dt>Competition</dt><dd>{competitions[selected.enrollmentId]?.competition_name || 'Competition not added'}</dd></div>
          <div><dt>Session focus</dt><dd>{selected.focusName || 'Not selected'}</dd></div>
          <div><dt>Mentor</dt><dd>{selected.mentorName || selected.primaryMentorName || 'Mentor not assigned'}</dd></div>
          <div><dt>Schedule</dt><dd>{scheduleText(selected)}</dd></div>
          <div><dt>Time zone</dt><dd>{selected.mentorTimezone || 'Local time'}</dd></div>
          <div><dt>Meeting link</dt><dd>{selected.status === 'scheduled' && selected.meetingUrl ? 'Available' : 'Not available'}</dd></div>
        </dl>
        <MentoringSessionPreferences kind="private" sessionId={selected.sessionId} role="mentee" />
        <details className="mentoring-audit-details"><summary>Session ID</summary><div className="session-reference-row"><code>{selected.sessionId}</code><CopyTextButton value={selected.sessionId} label="Copy Session ID" language="en" /></div></details>
        <div className={styles.dialogActions}>{selected.status === 'scheduled' && selected.meetingUrl ? <><a className="button button-primary" href={selected.meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Join Zoom</a><CopyTextButton value={selected.meetingUrl} label="Copy Zoom link" language="en" /></> : null}<a className="button button-outline" href={supportHref(selected)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Contact admin</a></div>
      </div> : null}
    </dialog>
  </div>
}
