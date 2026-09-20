'use client'

import { Eye, History as HistoryIcon, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import dataStyles from '@/components/admin/data-management.module.css'
import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import { historyMentorSessions, type MentorDashboardData, type MentorSessionRow } from '@/lib/mentor/dashboard'
import { SessionDetailDialog } from './mentor-detail-dialogs'
import type { MentorDashboardSection } from './mentor-overview'
import { DataError, EmptyState, MentorPageHeader, mentorSessionStatusLabel, sessionDate, sortNumber, sortText, statusClass, timestamp } from './dashboard-ui'

type HistorySortKey = 'date' | 'mentee' | 'focus' | 'status'
const PAGE_SIZE = 8

export function HistoryPanel({ data, open, onRetry }: { data: MentorDashboardData; open: (section: MentorDashboardSection) => void; onRetry: () => void }) {
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
    const q = query.trim().toLocaleLowerCase('id-ID')
    const filtered = history.filter(session => {
      const matchesQuery = !q || [session.mentee_name,session.mentee_email,session.focus_name,session.resolved_topic,session.program_name,session.mentoring_type].some(value => value?.toLocaleLowerCase('id-ID').includes(q))
      return matchesQuery && (status === 'all' || session.status === status)
    })
    if (!sortKey || !direction) return filtered
    return [...filtered].sort((left, right) => {
      if (sortKey === 'date') return sortNumber(timestamp(left.scheduled_start_at, Number.NEGATIVE_INFINITY), timestamp(right.scheduled_start_at, Number.NEGATIVE_INFINITY), direction)
      if (sortKey === 'mentee') return sortText(left.mentee_name || left.mentee_email, right.mentee_name || right.mentee_email, direction)
      if (sortKey === 'focus') return sortText(left.focus_name, right.focus_name, direction)
      return sortText(mentorSessionStatusLabel(left.status), mentorSessionStatusLabel(right.status), direction)
    })
  }, [direction, history, query, sortKey, status])

  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1))
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const changeSort = (key: string | null, next: SortDirection) => { setSortKey(key as HistorySortKey | null); setDirection(next); setPage(0) }

  return <div className="mentor-section">
    <MentorPageHeader eyebrow="Riwayat sesi" title="Sesi yang sudah masuk riwayat." detail="Riwayat hanya menggunakan status canonical selesai atau dibatalkan; sesi yang dibatalkan tidak pernah dilabeli selesai." action={<button type="button" className="button button-primary" onClick={() => open('availability')}>Atur ketersediaan</button>}/>
    {data.sessionError ? <DataError message={data.sessionError} onRetry={onRetry}/> : <section className={dataStyles.surface}>
      <div className={dataStyles.toolbar}><label className={dataStyles.searchField}><span>Cari riwayat</span><span className={dataStyles.searchControl}><Search aria-hidden="true"/><input value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Mentee atau fokus"/></span></label><label className={dataStyles.filterField}><span>Status</span><select value={status} onChange={event => { setStatus(event.target.value as 'all' | 'completed' | 'cancelled'); setPage(0) }}><option value="all">Semua riwayat</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></label></div>
      {rows.length ? <><div className={dataStyles.tableScroll}><table className={`${dataStyles.table} mentor-history-table`} data-testid="mentor-history-table"><thead><tr><SortableTableHeader label="Tanggal" sortKey="date" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><SortableTableHeader label="Mentee" sortKey="mentee" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><SortableTableHeader label="Fokus" sortKey="focus" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><th scope="col">Durasi</th><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><th scope="col" className={dataStyles.actionCell}>Aksi</th></tr></thead><tbody>{visible.map(session => <tr key={session.session_id}><td className={dataStyles.dateCell}>{sessionDate(session, data.timezone)}</td><td><strong>{session.mentee_name || 'Peserta Strativate'}</strong><div className={dataStyles.secondaryText}>{session.mentee_email}</div></td><td><span className={'ops-status '+(session.mentoring_type==='intensive'?'ops-status--info':'ops-status--neutral')}>{session.mentoring_type==='intensive'?'Intensive':'Private'}</span><strong>{session.resolved_topic||session.focus_name||'Belum dicatat'}</strong>{session.mentoring_type==='intensive'&&session.program_name?<div className={dataStyles.secondaryText}>{session.program_name}</div>:null}</td><td>{session.duration_minutes ? `${session.duration_minutes} menit` : '—'}</td><td><span className={statusClass(session.status)}>{mentorSessionStatusLabel(session.status)}</span></td><td className={dataStyles.actionCell}><button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={() => setSelectedSessionId(session.session_id)} aria-label={`Lihat detail riwayat sesi ${session.session_number} ${session.mentee_name || session.mentee_email}`}><Eye aria-hidden="true" size={14}/>Detail</button></td></tr>)}</tbody></table></div><TablePagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="Halaman riwayat sesi mentor"/></> : <EmptyState icon={HistoryIcon} title={history.length ? 'Tidak ada riwayat yang cocok.' : 'Belum ada riwayat sesi.'} detail={history.length ? 'Ubah pencarian atau filter status.' : 'Sesi berstatus selesai atau dibatalkan akan muncul di sini.'}/>}
    </section>}
    <SessionDetailDialog session={selected} timezone={data.timezone} onClose={() => setSelectedSessionId(null)}/>
  </div>
}
