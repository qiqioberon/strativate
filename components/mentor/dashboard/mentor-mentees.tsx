'use client'

import { Eye, Search, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'

import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import { buildMentorMenteeSummaries, type MentorDashboardData, type MentorMenteeSummary } from '@/lib/mentor/dashboard'
import { MenteeDetailDialog } from './mentor-detail-dialogs'
import type { MentorDashboardSection } from './mentor-overview'
import { DataError, EmptyState, MentorPageHeader, sessionDate, sortNumber, sortText, timestamp } from './dashboard-ui'
import styles from './mentor-operations.module.css'

type MenteeSortKey = 'mentee' | 'progress' | 'next'
const PAGE_SIZE = 8

export function MenteePanel({ data, onRetry }: { data: MentorDashboardData; open: (section: MentorDashboardSection) => void; onRetry: () => void }) {
  const summaries = useMemo(() => buildMentorMenteeSummaries(data.sessions, new Date()), [data.sessions])
  const [query, setQuery] = useState('')
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'upcoming' | 'none'>('all')
  const [sortKey, setSortKey] = useState<MenteeSortKey | null>('mentee')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<MentorMenteeSummary | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('en-GB')
    const filtered = summaries.filter(summary => {
      const matchesQuery = !q || [summary.menteeName, summary.menteeEmail, ...summary.focusNames].some(value => value.toLocaleLowerCase('en-GB').includes(q))
      const matchesSchedule = scheduleFilter === 'all' || (scheduleFilter === 'upcoming' ? Boolean(summary.nextSession) : !summary.nextSession)
      return matchesQuery && matchesSchedule
    })
    if (!sortKey || !direction) return filtered
    return [...filtered].sort((left, right) => {
      if (sortKey === 'mentee') return sortText(left.menteeName, right.menteeName, direction)
      if (sortKey === 'progress') return sortNumber(left.completedSessions, right.completedSessions, direction)
      return sortNumber(timestamp(left.nextSession?.scheduled_start_at || null), timestamp(right.nextSession?.scheduled_start_at || null), direction)
    })
  }, [direction, query, scheduleFilter, sortKey, summaries])

  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1))
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const changeSort = (key: string | null, next: SortDirection) => { setSortKey(key as MenteeSortKey | null); setDirection(next); setPage(0) }

  return <div className="mentor-section">
    <MentorPageHeader title="My mentees" />
    {data.sessionError ? <DataError message={data.sessionError} onRetry={onRetry} /> : <section className={styles.surface}>
      <div className={`${styles.toolbar} ${styles.toolbarTwo}`}>
        <label className={styles.field}><span>Search mentees</span><span className={styles.searchControl}><Search aria-hidden="true" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Name, email, or focus" /></span></label>
        <label className={styles.field}><span>Schedule</span><select value={scheduleFilter} onChange={event => { setScheduleFilter(event.target.value as 'all' | 'upcoming' | 'none'); setPage(0) }}><option value="all">All mentees</option><option value="upcoming">Has upcoming session</option><option value="none">No upcoming session</option></select></label>
      </div>
      {rows.length ? <>
        <div className={styles.tableWrap}><table className={`${styles.table} ${styles.menteesTable}`} data-testid="mentor-mentees-table">
          <colgroup><col className={styles.menteeIdentityCol} /><col className={styles.menteeFocusCol} /><col className={styles.menteeProgressCol} /><col className={styles.menteeProgramCol} /><col className={styles.menteeNextCol} /><col className={styles.menteeActionCol} /></colgroup>
          <thead><tr><SortableTableHeader label="Mentee" sortKey="mentee" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><th scope="col">Mentoring focus</th><SortableTableHeader label="Session progress" sortKey="progress" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><th scope="col">Program</th><SortableTableHeader label="Next session" sortKey="next" activeKey={sortKey} direction={direction} onSortChange={changeSort} /><th scope="col">Actions</th></tr></thead>
          <tbody>{visible.map(summary => <tr key={summary.enrollmentId}>
            <td data-label="Mentee"><div className={styles.identity}><span className={styles.avatar}>{summary.menteeName.slice(0, 2).toUpperCase()}</span><span className={styles.identityText}><strong className={styles.primary}>{summary.menteeName}</strong><span className={styles.secondary}>{summary.menteeEmail || 'Email unavailable'}</span></span></div></td>
            <td data-label="Mentoring focus"><span>{summary.focusNames.length ? summary.focusNames.join(', ') : 'Not recorded'}</span></td>
            <td data-label="Session progress"><div className={styles.stack}><strong>{summary.completedSessions}/{summary.progressSessions} completed</strong><span className={`${styles.secondary} ${styles.wrapSecondary}`}>{summary.assignedSessions} {summary.assignedSessions === 1 ? 'session' : 'sessions'} assigned{summary.cancelledSessions ? ` · ${summary.cancelledSessions} cancelled` : ''}</span></div></td>
            <td data-label="Program"><div className={styles.stack}><strong>{summary.mentoringType === 'intensive' ? 'Intensive Mentoring' : 'Private Mentoring'}</strong><span className={`${styles.secondary} ${styles.wrapSecondary}`}>{summary.programName}{summary.purchasedSessions ? ` · ${summary.purchasedSessions} sessions purchased` : ''}</span></div></td>
            <td data-label="Next session" className={styles.date}>{summary.nextSession ? sessionDate(summary.nextSession, data.timezone) : 'No upcoming session'}</td>
            <td data-label="Actions" className={styles.actionCell}><button type="button" className={`button button-outline ${styles.tableAction}`} onClick={() => setSelected(summary)} aria-label={`View details for ${summary.menteeName}`}><Eye aria-hidden="true" />Details</button></td>
          </tr>)}</tbody>
        </table></div>
        <TablePagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="Mentor mentee pages" language="en" />
      </> : <EmptyState icon={UsersRound} title={summaries.length ? 'No mentees match these filters.' : 'No mentees yet.'} detail={summaries.length ? 'Adjust the search or schedule filter.' : 'Mentees will appear after sessions are assigned to you.'} />}
    </section>}
    <MenteeDetailDialog summary={selected} timezone={data.timezone} onClose={() => setSelected(null)} />
  </div>
}
