'use client'

import { Eye, History as HistoryIcon, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import { historyMentorSessions, type MentorDashboardData } from '@/lib/mentor/dashboard'
import { SessionDetailDialog } from './mentor-detail-dialogs'
import type { MentorDashboardSection } from './mentor-overview'
import { DataError, EmptyState, MentorPageHeader, mentorSessionStatusLabel, sessionDate, sortNumber, sortText, statusClass, timestamp } from './dashboard-ui'
import styles from './mentor-operations.module.css'

type HistorySortKey = 'date' | 'mentee' | 'focus' | 'status'
const PAGE_SIZE = 8

export function HistoryPanel({ data, onRetry }: { data: MentorDashboardData; open: (section: MentorDashboardSection) => void; onRetry: () => void }) {
  const history = useMemo(() => historyMentorSessions(data.sessions), [data.sessions])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'completed' | 'cancelled'>('all')
  const [sortKey, setSortKey] = useState<HistorySortKey | null>('date')
  const [direction, setDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(0)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const selected = useMemo(
    () => selectedSessionId ? history.find(session => session.session_id === selectedSessionId) ?? null : null,
    [history, selectedSessionId],
  )

  useEffect(() => {
    if (selectedSessionId && !selected) setSelectedSessionId(null)
  }, [selected, selectedSessionId])

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('en-GB')
    const filtered = history.filter(session => {
      const matchesQuery = !q || [session.mentee_name, session.mentee_email, session.focus_name, session.resolved_topic, session.program_name, session.mentoring_type].some(value => value?.toLocaleLowerCase('en-GB').includes(q))
      return matchesQuery && (status === 'all' || session.status === status)
    })
    if (!sortKey || !direction) return filtered
    return [...filtered].sort((left, right) => {
      if (sortKey === 'date') return sortNumber(timestamp(left.scheduled_start_at, Number.NEGATIVE_INFINITY), timestamp(right.scheduled_start_at, Number.NEGATIVE_INFINITY), direction)
      if (sortKey === 'mentee') return sortText(left.mentee_name || left.mentee_email, right.mentee_name || right.mentee_email, direction)
      if (sortKey === 'focus') return sortText(left.resolved_topic || left.focus_name, right.resolved_topic || right.focus_name, direction)
      return sortText(mentorSessionStatusLabel(left.status), mentorSessionStatusLabel(right.status), direction)
    })
  }, [direction, history, query, sortKey, status])

  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1))
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const changeSort = (key: string | null, next: SortDirection) => { setSortKey(key as HistorySortKey | null); setDirection(next); setPage(0) }

  return <div className="mentor-section">
    <MentorPageHeader title="Session history" />
    {data.sessionError ? <DataError message={data.sessionError} onRetry={onRetry} /> : <section className={styles.surface}>
      <div className={`${styles.toolbar} ${styles.toolbarTwo}`}>
        <label className={styles.field}><span>Search history</span><span className={styles.searchControl}><Search aria-hidden="true" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Mentee or focus" /></span></label>
        <label className={styles.field}><span>Status</span><select value={status} onChange={event => { setStatus(event.target.value as 'all' | 'completed' | 'cancelled'); setPage(0) }}><option value="all">All history</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      </div>
      {rows.length ? <>
        <div className={styles.tableWrap}><table className={`${styles.table} ${styles.historyTable}`} data-testid="mentor-history-table">
          <colgroup><col className={styles.historyDateCol} /><col className={styles.historyMenteeCol} /><col className={styles.historyFocusCol} /><col className={styles.historyDurationCol} /><col className={styles.historyStatusCol} /><col className={styles.historyActionCol} /></colgroup>
          <thead><tr><SortableTableHeader label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><SortableTableHeader label="Mentee" sortKey="mentee" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><SortableTableHeader label="Focus" sortKey="focus" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><th scope="col">Duration</th><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><th scope="col">Actions</th></tr></thead>
          <tbody>{visible.map(session => <tr key={session.session_id}>
            <td data-label="Date" className={styles.date}>{sessionDate(session, data.timezone)}</td>
            <td data-label="Mentee"><div className={styles.stack}><strong>{session.mentee_name || 'Strativate mentee'}</strong><span className={styles.secondary}>{session.mentee_email || 'Email unavailable'}</span></div></td>
            <td data-label="Focus"><div className={styles.stack}><div className={styles.focusRow}><span className={`${styles.typeBadge} ${session.mentoring_type === 'intensive' ? styles.typeBadgeIntensive : ''}`}>{session.mentoring_type === 'intensive' ? 'Intensive' : 'Private'}</span><strong>{session.resolved_topic || session.focus_name || 'Not recorded'}</strong></div>{session.mentoring_type === 'intensive' && session.program_name ? <span className={`${styles.secondary} ${styles.wrapSecondary}`}>{session.program_name}</span> : null}</div></td>
            <td data-label="Duration">{session.duration_minutes ? `${session.duration_minutes} minutes` : 'Not recorded'}</td>
            <td data-label="Status"><span className={statusClass(session.status)}>{mentorSessionStatusLabel(session.status)}</span></td>
            <td data-label="Actions" className={styles.actionCell}><button type="button" className={`button button-outline ${styles.tableAction}`} onClick={() => setSelectedSessionId(session.session_id)} aria-label={`View history details for session ${session.session_number} ${session.mentee_name || session.mentee_email}`}><Eye aria-hidden="true" />Details</button></td>
          </tr>)}</tbody>
        </table></div>
        <TablePagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="Mentor session history pages" language="en" />
      </> : <EmptyState icon={HistoryIcon} title={history.length ? 'No history matches these filters.' : 'No session history yet.'} detail={history.length ? 'Adjust the search or status filter.' : 'Completed or cancelled sessions will appear here.'} />}
    </section>}
    <SessionDetailDialog session={selected} timezone={data.timezone} onClose={() => setSelectedSessionId(null)} />
  </div>
}
