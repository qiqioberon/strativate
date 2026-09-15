'use client'

import { ClipboardList, Eye, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import dataStyles from '@/components/admin/data-management.module.css'
import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import type { MentorDashboardData, MentorSessionRow, MentorSessionStatus } from '@/lib/mentor/dashboard'
import { SessionDetailDialog } from './mentor-detail-dialogs'
import type { MentorDashboardSection } from './mentor-overview'
import { DataError, EmptyState, MentorPageHeader, mentorSessionStatusLabel, sessionDate, sortNumber, sortText, statusClass, timestamp } from './dashboard-ui'

type AssignmentSortKey = 'mentee' | 'focus' | 'session' | 'schedule' | 'status'
const PAGE_SIZE = 8

export function AssignmentPanel({ data, open, onRetry }: { data: MentorDashboardData; open: (section: MentorDashboardSection) => void; onRetry: () => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | MentorSessionStatus>('all')
  const [sortKey, setSortKey] = useState<AssignmentSortKey | null>('schedule')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<MentorSessionRow | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('id-ID')
    const filtered = data.sessions.filter(session => {
      const matchesQuery = !q || [session.mentee_name, session.mentee_email, session.focus_name, `sesi ${session.session_number}`].some(value => value?.toLocaleLowerCase('id-ID').includes(q))
      return matchesQuery && (status === 'all' || session.status === status)
    })
    if (!sortKey || !direction) return filtered
    return [...filtered].sort((left, right) => {
      if (sortKey === 'mentee') return sortText(left.mentee_name || left.mentee_email, right.mentee_name || right.mentee_email, direction)
      if (sortKey === 'focus') return sortText(left.focus_name, right.focus_name, direction)
      if (sortKey === 'session') return sortNumber(left.session_number, right.session_number, direction)
      if (sortKey === 'status') return sortText(mentorSessionStatusLabel(left.status), mentorSessionStatusLabel(right.status), direction)
      return sortNumber(timestamp(left.scheduled_start_at), timestamp(right.scheduled_start_at), direction)
    })
  }, [data.sessions, direction, query, sortKey, status])

  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1))
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const changeSort = (key: string | null, next: SortDirection) => { setSortKey(key as AssignmentSortKey | null); setDirection(next); setPage(0) }

  return <div className="mentor-section">
    <MentorPageHeader eyebrow="Penugasan" title="Sesi yang menjadi tanggung jawab Anda." detail="Penugasan mengikuti sesi yang benar-benar dialokasikan admin kepada akun mentor Anda; tidak ada alur accept/reject tambahan." action={<button type="button" className="button button-primary" onClick={() => open('availability')}>Atur ketersediaan</button>}/>
    {data.sessionError ? <DataError message={data.sessionError} onRetry={onRetry}/> : <section className={dataStyles.surface}>
      <div className={dataStyles.toolbar}>
        <label className={dataStyles.searchField}><span>Cari penugasan</span><span className={dataStyles.searchControl}><Search aria-hidden="true"/><input value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Mentee, email, atau fokus"/></span></label>
        <label className={dataStyles.filterField}><span>Status sesi</span><select value={status} onChange={event => { setStatus(event.target.value as 'all' | MentorSessionStatus); setPage(0) }}><option value="all">Semua status</option><option value="scheduled">Terjadwal</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></label>
      </div>
      {rows.length ? <><div className={dataStyles.tableScroll}><table className={`${dataStyles.table} mentor-ops-table`} data-testid="mentor-assignment-table"><thead><tr><SortableTableHeader label="Mentee" sortKey="mentee" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><th scope="col">Paket</th><SortableTableHeader label="Fokus" sortKey="focus" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><SortableTableHeader label="Sesi" sortKey="session" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><SortableTableHeader label="Jadwal" sortKey="schedule" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><th scope="col" className={dataStyles.actionCell}>Aksi</th></tr></thead><tbody>{visible.map(session => <tr key={session.session_id}><td><div className={dataStyles.identity}><span className={dataStyles.avatar}>{(session.mentee_name || session.mentee_email || 'P').slice(0, 2).toUpperCase()}</span><span className={dataStyles.identityText}><strong className={dataStyles.primaryText}>{session.mentee_name || 'Peserta Strativate'}</strong><span className={dataStyles.secondaryText}>{session.mentee_email || 'Email tidak tersedia'}</span></span></div></td><td><strong>Private Mentoring</strong><div className={dataStyles.secondaryText}>{session.purchased_sessions} sesi dibeli</div></td><td>{session.focus_name || 'Belum dicatat'}</td><td>Sesi {session.session_number}/{session.purchased_sessions}</td><td className={dataStyles.dateCell}>{sessionDate(session, data.timezone)}</td><td><span className={statusClass(session.status)}>{mentorSessionStatusLabel(session.status)}</span></td><td className={dataStyles.actionCell}><button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={() => setSelected(session)} aria-label={`Lihat detail sesi ${session.session_number} ${session.mentee_name || session.mentee_email}`}><Eye aria-hidden="true" size={14}/>Detail</button></td></tr>)}</tbody></table></div><TablePagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="Halaman penugasan mentor"/></> : <EmptyState icon={ClipboardList} title={data.sessions.length ? 'Tidak ada penugasan yang cocok.' : 'Belum ada penugasan.'} detail={data.sessions.length ? 'Ubah pencarian atau filter untuk melihat sesi lain.' : 'Sesi akan muncul setelah admin menjadwalkan Private Mentoring kepada Anda.'}/>} 
    </section>}
    <SessionDetailDialog session={selected} timezone={data.timezone} onClose={() => setSelected(null)}/>
  </div>
}
