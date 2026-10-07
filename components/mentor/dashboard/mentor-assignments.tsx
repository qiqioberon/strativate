'use client'

import { Clock3, ClipboardList, ExternalLink, Eye, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import type { MentorDashboardData, MentorSessionStatus } from '@/lib/mentor/dashboard'
import { SessionDetailDialog } from './mentor-detail-dialogs'
import type { MentorDashboardSection } from './mentor-overview'
import { DataError, EmptyState, MentorPageHeader, mentorSessionStatusLabel, sessionDate, sortNumber, sortText, statusClass, timestamp } from './dashboard-ui'
import styles from './mentor-operations.module.css'

type AssignmentSortKey = 'mentee' | 'focus' | 'session' | 'schedule' | 'status'
const PAGE_SIZE = 8

function shortId(id: string) { return `…${id.slice(-8)}` }

export function AssignmentPanel({
  data,
  open,
  onRetry,
  focusSessionId,
}: {
  data: MentorDashboardData
  open: (section: MentorDashboardSection) => void
  onRetry: () => void
  focusSessionId?: string | null
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | MentorSessionStatus>('all')
  const [type, setType] = useState<'all' | 'private' | 'intensive'>('all')
  const [sortKey, setSortKey] = useState<AssignmentSortKey | null>('schedule')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const [page, setPage] = useState(0)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const selected = useMemo(
    () => selectedSessionId ? data.sessions.find(session => session.session_id === selectedSessionId) ?? null : null,
    [data.sessions, selectedSessionId],
  )

  useEffect(() => {
    if (selectedSessionId && !selected) setSelectedSessionId(null)
  }, [selected, selectedSessionId])

  useEffect(() => {
    if (!focusSessionId) return
    const match = data.sessions.find(session => session.session_id === focusSessionId)
    if (match) setSelectedSessionId(match.session_id)
  }, [data.sessions, focusSessionId])

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('en-GB')
    const filtered = data.sessions.filter(session => {
      const matchesQuery = !q || [session.session_id, session.mentee_name, session.mentee_email, session.focus_name, session.resolved_topic, session.program_name, `session ${session.session_number}`]
        .some(value => value?.toLocaleLowerCase('en-GB').includes(q))
      return matchesQuery && (status === 'all' || session.status === status) && (type === 'all' || session.mentoring_type === type)
    })
    if (!sortKey || !direction) return filtered
    return [...filtered].sort((left, right) => {
      if (sortKey === 'mentee') return sortText(left.mentee_name || left.mentee_email, right.mentee_name || right.mentee_email, direction)
      if (sortKey === 'focus') return sortText(left.resolved_topic || left.focus_name, right.resolved_topic || right.focus_name, direction)
      if (sortKey === 'session') return sortNumber(left.session_number, right.session_number, direction)
      if (sortKey === 'status') return sortText(mentorSessionStatusLabel(left.status), mentorSessionStatusLabel(right.status), direction)
      return sortNumber(timestamp(left.scheduled_start_at), timestamp(right.scheduled_start_at), direction)
    })
  }, [data.sessions, direction, query, sortKey, status, type])

  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1))
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const changeSort = (key: string | null, next: SortDirection) => { setSortKey(key as AssignmentSortKey | null); setDirection(next); setPage(0) }

  return <div className="mentor-section">
    <MentorPageHeader title="Assignments" action={<button type="button" className="button button-primary button-compact" onClick={() => open('availability')}><Clock3 aria-hidden="true" size={15} />Set availability</button>} />
    {data.sessionError ? <DataError message={data.sessionError} onRetry={onRetry} /> : <section className={styles.surface}>
      <div className={styles.toolbar}>
        <label className={styles.field}><span>Search assignments</span><span className={styles.searchControl}><Search aria-hidden="true" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Session ID, mentee, email, or focus" /></span></label>
        <label className={styles.field}><span>Mentoring type</span><select value={type} onChange={event => { setType(event.target.value as 'all' | 'private' | 'intensive'); setPage(0) }}><option value="all">All types</option><option value="private">Private Mentoring</option><option value="intensive">Intensive Mentoring</option></select></label>
        <label className={styles.field}><span>Session status</span><select value={status} onChange={event => { setStatus(event.target.value as 'all' | MentorSessionStatus); setPage(0) }}><option value="all">All statuses</option><option value="awaiting_focus">Awaiting admin review</option><option value="awaiting_scheduling">Awaiting scheduling</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      </div>
      {rows.length ? <>
        <div className={styles.tableWrap}><table className={`${styles.table} ${styles.assignmentsTable}`} data-testid="mentor-assignment-table">
          <colgroup><col className={styles.assignmentMenteeCol} /><col className={styles.assignmentSessionCol} /><col className={styles.assignmentFocusCol} /><col className={styles.assignmentScheduleCol} /><col className={styles.assignmentStatusCol} /><col className={styles.assignmentZoomCol} /><col className={styles.assignmentActionCol} /></colgroup>
          <thead><tr><SortableTableHeader label="Mentee" sortKey="mentee" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><th scope="col">Mentoring / session</th><SortableTableHeader label="Focus" sortKey="focus" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><SortableTableHeader label="Schedule" sortKey="schedule" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><th scope="col">Zoom</th><th scope="col">Actions</th></tr></thead>
          <tbody>{visible.map(session => <tr key={session.session_id}>
            <td data-label="Mentee"><div className={styles.identity}><span className={styles.avatar}>{(session.mentee_name || session.mentee_email || 'S').slice(0, 2).toUpperCase()}</span><span className={styles.identityText}><strong className={styles.primary}>{session.mentee_name || 'Strativate mentee'}</strong><span className={styles.secondary}>{session.mentee_email || 'Email unavailable'}</span></span></div></td>
            <td data-label="Mentoring / session"><div className={styles.stack}><span className={`${styles.typeBadge} ${session.mentoring_type === 'intensive' ? styles.typeBadgeIntensive : ''}`}>{session.mentoring_type === 'intensive' ? 'Intensive Mentoring' : 'Private Mentoring'}</span><strong>Session {session.session_number}{session.purchased_sessions ? `/${session.purchased_sessions}` : ''}</strong><span className={`${styles.secondary} ${styles.wrapSecondary}`}>{session.mentoring_type === 'intensive' && session.program_name ? session.program_name : session.purchased_sessions ? `${session.purchased_sessions} sessions purchased` : 'Program not recorded'}</span><code className={styles.mutedCode} title={session.session_id}>{shortId(session.session_id)}</code></div></td>
            <td data-label="Focus"><strong>{session.resolved_topic || session.focus_name || 'Focus not selected'}</strong></td>
            <td data-label="Schedule" className={styles.date}>{sessionDate(session, data.timezone)}</td>
            <td data-label="Status"><span className={statusClass(session.status)}>{mentorSessionStatusLabel(session.status)}</span></td>
            <td data-label="Zoom">{session.status === 'scheduled' && session.meeting_url ? <a className={`button button-primary ${styles.tableLink}`} href={session.meeting_url} target="_blank" rel="noopener noreferrer" aria-label={`Join Zoom for session ${session.session_number}`}><ExternalLink aria-hidden="true" />Zoom</a> : <span className={styles.unavailable}>Meeting unavailable</span>}</td>
            <td data-label="Actions" className={styles.actionCell}><button type="button" className={`button button-outline ${styles.tableAction}`} onClick={() => setSelectedSessionId(session.session_id)} aria-label={`View details for session ${session.session_number} ${session.mentee_name || session.mentee_email}`}><Eye aria-hidden="true" />Details</button></td>
          </tr>)}</tbody>
        </table></div>
        <TablePagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="Mentor assignment pages" language="en" />
      </> : <EmptyState icon={ClipboardList} title={data.sessions.length ? 'No assignments match these filters.' : 'No assignments yet.'} detail={data.sessions.length ? 'Adjust the search or filters to view other sessions.' : 'Assigned Private or Intensive Mentoring sessions will appear here.'} />}
    </section>}
    <SessionDetailDialog session={selected} timezone={data.timezone} onClose={() => setSelectedSessionId(null)} />
  </div>
}
