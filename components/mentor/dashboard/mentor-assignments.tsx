'use client'

import { ClipboardList, ExternalLink, Eye, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import dataStyles from '@/components/admin/data-management.module.css'
import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import type { MentorDashboardData, MentorSessionRow, MentorSessionStatus } from '@/lib/mentor/dashboard'
import { SessionDetailDialog } from './mentor-detail-dialogs'
import type { MentorDashboardSection } from './mentor-overview'
import { DataError, EmptyState, MentorPageHeader, mentorSessionStatusLabel, sessionDate, sortNumber, sortText, statusClass, timestamp } from './dashboard-ui'

type AssignmentSortKey = 'mentee' | 'focus' | 'session' | 'schedule' | 'status'
const PAGE_SIZE = 8
function shortId(id:string){return '…'+id.slice(-8)}

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
  const [type,setType]=useState<'all'|'private'|'intensive'>('all')
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

  useEffect(()=>{
    if(!focusSessionId)return
    const match=data.sessions.find(session=>session.session_id===focusSessionId)
    if(match)setSelectedSessionId(match.session_id)
  },[data.sessions,focusSessionId])

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('id-ID')
    const filtered = data.sessions.filter(session => {
      const matchesQuery=!q||[session.session_id,session.mentee_name,session.mentee_email,session.focus_name,session.resolved_topic,session.program_name,`sesi ${session.session_number}`].some(value=>value?.toLocaleLowerCase('id-ID').includes(q))
      return matchesQuery&&(status==='all'||session.status===status)&&(type==='all'||session.mentoring_type===type)
    })
    if (!sortKey || !direction) return filtered
    return [...filtered].sort((left, right) => {
      if (sortKey === 'mentee') return sortText(left.mentee_name || left.mentee_email, right.mentee_name || right.mentee_email, direction)
      if (sortKey === 'focus') return sortText(left.focus_name, right.focus_name, direction)
      if (sortKey === 'session') return sortNumber(left.session_number, right.session_number, direction)
      if (sortKey === 'status') return sortText(mentorSessionStatusLabel(left.status), mentorSessionStatusLabel(right.status), direction)
      return sortNumber(timestamp(left.scheduled_start_at), timestamp(right.scheduled_start_at), direction)
    })
  }, [data.sessions, direction, query, sortKey, status, type])

  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1))
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const changeSort = (key: string | null, next: SortDirection) => { setSortKey(key as AssignmentSortKey | null); setDirection(next); setPage(0) }

  return <div className="mentor-section">
    <MentorPageHeader eyebrow="Penugasan" title="Sesi yang menjadi tanggung jawab Anda." detail="Cari dengan nama peserta, email, fokus, nomor sesi, atau Session ID. Zoom dapat dibuka langsung dari tabel." action={<button type="button" className="button button-primary" onClick={() => open('availability')}>Atur ketersediaan</button>}/>
    {data.sessionError ? <DataError message={data.sessionError} onRetry={onRetry}/> : <section className={dataStyles.surface}>
      <div className={dataStyles.toolbar}>
        <label className={dataStyles.searchField}><span>Cari penugasan</span><span className={dataStyles.searchControl}><Search aria-hidden="true"/><input value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Session ID, mentee, email, atau fokus"/></span></label>
        <label className={dataStyles.filterField}><span>Jenis mentoring</span><select value={type} onChange={event=>{setType(event.target.value as 'all'|'private'|'intensive');setPage(0)}}><option value="all">Semua jenis</option><option value="private">Private Mentoring</option><option value="intensive">Intensive Mentoring</option></select></label>
        <label className={dataStyles.filterField}><span>Status sesi</span><select value={status} onChange={event => { setStatus(event.target.value as 'all' | MentorSessionStatus); setPage(0) }}><option value="all">Semua status</option><option value="scheduled">Terjadwal</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></label>
      </div>
      {rows.length ? <><div className={dataStyles.tableScroll}><table className={`${dataStyles.table} mentor-ops-table mentor-assignment-table`} data-testid="mentor-assignment-table"><thead><tr><SortableTableHeader label="Mentee" sortKey="mentee" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><th scope="col">Mentoring / sesi</th><SortableTableHeader label="Fokus" sortKey="focus" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><SortableTableHeader label="Jadwal" sortKey="schedule" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSortChange={changeSort}/><th scope="col">Zoom</th><th scope="col" className={dataStyles.actionCell}>Aksi</th></tr></thead><tbody>{visible.map(session => <tr key={session.session_id}><td data-label="Mentee" className="mentor-assignment-table__mentee"><div className={`${dataStyles.identity} mentor-assignment-identity`}><span className={dataStyles.avatar}>{(session.mentee_name || session.mentee_email || 'P').slice(0, 2).toUpperCase()}</span><span className={dataStyles.identityText}><strong className={dataStyles.primaryText}>{session.mentee_name || 'Peserta Strativate'}</strong><span className={dataStyles.secondaryText}>{session.mentee_email || 'Email tidak tersedia'}</span></span></div></td><td data-label="Mentoring / sesi" className="mentor-assignment-table__summary"><span className={'ops-status '+(session.mentoring_type==='intensive'?'ops-status--info':'ops-status--neutral')}>{session.mentoring_type==='intensive'?'Intensive':'Private'}</span><strong>Sesi {session.session_number}{session.purchased_sessions?'/'+session.purchased_sessions:''}</strong><div className={dataStyles.secondaryText}><code title={session.session_id}>{shortId(session.session_id)}</code>{session.mentoring_type==='intensive'&&session.program_name?' · '+session.program_name:session.purchased_sessions?' · '+session.purchased_sessions+' sesi dibeli':''}</div></td><td data-label="Topik / Fokus" className="mentor-assignment-table__focus"><strong>{session.resolved_topic||session.focus_name||'Belum dicatat'}</strong></td><td data-label="Jadwal" className={`${dataStyles.dateCell} mentor-assignment-table__schedule`}>{sessionDate(session, data.timezone)}</td><td data-label="Status" className="mentor-assignment-table__status"><span className={statusClass(session.status)}>{mentorSessionStatusLabel(session.status)}</span></td><td data-label="Zoom" className="mentor-assignment-table__control">{session.status==='scheduled'&&session.meeting_url?<a className="button button-primary button-compact" href={session.meeting_url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true"/>Zoom</a>:<span className={dataStyles.secondaryText}>Belum tersedia</span>}</td><td data-label="Aksi" className={`${dataStyles.actionCell} mentor-assignment-table__control`}><button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={() => setSelectedSessionId(session.session_id)} aria-label={`Lihat detail sesi ${session.session_number} ${session.mentee_name || session.mentee_email}`}><Eye aria-hidden="true" size={14}/>Detail</button></td></tr>)}</tbody></table></div><TablePagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="Halaman penugasan mentor"/></> : <EmptyState icon={ClipboardList} title={data.sessions.length ? 'Tidak ada penugasan yang cocok.' : 'Belum ada penugasan.'} detail={data.sessions.length ? 'Ubah pencarian atau filter untuk melihat sesi lain.' : 'Sesi Private atau Intensive akan muncul setelah admin menjadwalkannya kepada Anda.'}/>}
    </section>}
    <SessionDetailDialog session={selected} timezone={data.timezone} onClose={() => setSelectedSessionId(null)}/>
  </div>
}
