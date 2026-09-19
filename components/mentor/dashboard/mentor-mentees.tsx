'use client'

import { Eye, Search, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'

import dataStyles from '@/components/admin/data-management.module.css'
import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import { buildMentorMenteeSummaries, type MentorDashboardData, type MentorMenteeSummary } from '@/lib/mentor/dashboard'
import { MenteeDetailDialog } from './mentor-detail-dialogs'
import type { MentorDashboardSection } from './mentor-overview'
import { DataError, EmptyState, MentorPageHeader, sessionDate, sortNumber, sortText, timestamp } from './dashboard-ui'

type MenteeSortKey = 'mentee' | 'progress' | 'next'
const PAGE_SIZE = 8

export function MenteePanel({ data, open, onRetry }: { data: MentorDashboardData; open: (section: MentorDashboardSection) => void; onRetry: () => void }) {
  const summaries = useMemo(() => buildMentorMenteeSummaries(data.sessions, new Date()), [data.sessions])
  const [query, setQuery] = useState('')
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'upcoming' | 'none'>('all')
  const [sortKey, setSortKey] = useState<MenteeSortKey | null>('mentee')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<MentorMenteeSummary | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('id-ID')
    const filtered = summaries.filter(summary => {
      const matchesQuery = !q || [summary.menteeName, summary.menteeEmail, ...summary.focusNames].some(value => value.toLocaleLowerCase('id-ID').includes(q))
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
    <MentorPageHeader eyebrow="Peserta saya" title="Peserta yang Anda dampingi." detail="Setiap baris mengikuti enrollment Private atau engagement Intensive yang memiliki sesi yang benar-benar dialokasikan kepada Anda." action={<button type="button" className="button button-primary" onClick={() => open('availability')}>Atur ketersediaan</button>}/>
    {data.sessionError ? <DataError message={data.sessionError} onRetry={onRetry}/> : <section className={dataStyles.surface}>
      <div className={dataStyles.toolbar}><label className={dataStyles.searchField}><span>Cari peserta</span><span className={dataStyles.searchControl}><Search aria-hidden="true"/><input value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Nama, email, atau fokus"/></span></label><label className={dataStyles.filterField}><span>Jadwal</span><select value={scheduleFilter} onChange={event => { setScheduleFilter(event.target.value as 'all' | 'upcoming' | 'none'); setPage(0) }}><option value="all">Semua peserta</option><option value="upcoming">Ada sesi mendatang</option><option value="none">Tanpa sesi mendatang</option></select></label></div>
      {rows.length ? <><div className={dataStyles.tableScroll}><table className={`${dataStyles.table} mentor-mentees-table`} data-testid="mentor-mentees-table"><thead><tr><SortableTableHeader label="Peserta" sortKey="mentee" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><th scope="col">Fokus mentoring</th><SortableTableHeader label="Progres sesi Anda" sortKey="progress" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><th scope="col">Paket</th><SortableTableHeader label="Sesi berikutnya" sortKey="next" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><th scope="col" className={dataStyles.actionCell}>Aksi</th></tr></thead><tbody>{visible.map(summary => <tr key={summary.enrollmentId}><td><div className={dataStyles.identity}><span className={dataStyles.avatar}>{summary.menteeName.slice(0, 2).toUpperCase()}</span><span className={dataStyles.identityText}><strong className={dataStyles.primaryText}>{summary.menteeName}</strong><span className={dataStyles.secondaryText}>{summary.menteeEmail}</span></span></div></td><td>{summary.focusNames.length ? summary.focusNames.join(', ') : 'Belum dicatat'}</td><td><strong>{summary.completedSessions}/{summary.progressSessions} selesai</strong><div className={dataStyles.secondaryText}>{summary.assignedSessions} sesi dialokasikan kepada Anda{summary.cancelledSessions ? ` · ${summary.cancelledSessions} dibatalkan` : ''}</div></td><td><strong>{summary.mentoringType==='intensive'?'Intensive Mentoring':'Private Mentoring'}</strong><div className={dataStyles.secondaryText}>{summary.programName}{summary.purchasedSessions?' · '+summary.purchasedSessions+' sesi dibeli':' · program berkelanjutan'}</div></td><td className={dataStyles.dateCell}>{summary.nextSession ? sessionDate(summary.nextSession, data.timezone) : 'Belum ada sesi mendatang'}</td><td className={dataStyles.actionCell}><button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={() => setSelected(summary)} aria-label={`Lihat detail peserta ${summary.menteeName}`}><Eye aria-hidden="true" size={14}/>Detail</button></td></tr>)}</tbody></table></div><TablePagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="Halaman peserta mentor"/></> : <EmptyState icon={UsersRound} title={summaries.length ? 'Tidak ada peserta yang cocok.' : 'Belum ada peserta yang dialokasikan.'} detail={summaries.length ? 'Ubah pencarian atau filter jadwal.' : 'Peserta akan muncul setelah ada sesi yang dialokasikan kepada Anda.'}/>} 
    </section>}
    <MenteeDetailDialog summary={selected} timezone={data.timezone} onClose={() => setSelected(null)}/>
  </div>
}
