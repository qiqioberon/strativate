'use client'

import { CalendarDays, ClipboardList, Clock3, ExternalLink, UsersRound } from 'lucide-react'
import { useMemo } from 'react'

import { buildMentorOverview, type MentorDashboardData } from '@/lib/mentor/dashboard'
import {
  availabilityLabel,
  availabilityTone,
  DataError,
  EmptyState,
  MentorPageHeader,
  Metric,
  mentorSessionStatusLabel,
  sessionDate,
  sessionDay,
  statusClass,
} from './dashboard-ui'

export type MentorDashboardSection = 'overview' | 'calendar' | 'assignments' | 'mentees' | 'availability' | 'history' | 'notifications' | 'profile'

export function MentorOverview({ name, data, open, onRetry }: { name: string; data: MentorDashboardData; open: (section: MentorDashboardSection) => void; onRetry: () => void }) {
  const overview = useMemo(() => buildMentorOverview(data.sessions, new Date(), data.timezone), [data.sessions, data.timezone])

  return <div className="mentor-section">
    <MentorPageHeader eyebrow="Dashboard mentor" title={`Selamat datang, ${name}.`} detail="Lihat agenda terdekat, peserta aktif, dan pekerjaan mentoring yang benar-benar terhubung ke akun Anda." action={<button type="button" className="button button-primary" onClick={() => open('availability')}>Atur ketersediaan</button>}/>
    {data.sessionError ? <DataError message={data.sessionError} onRetry={onRetry}/> : <>
      <div className="mentor-metric-grid" aria-label="Ringkasan mentor">
        <Metric label="Sesi hari ini" value={overview.sessionsToday} detail="Sesi Strativate pada tanggal lokal Anda"/>
        <Metric label="Sesi mendatang" value={overview.upcomingSessions} detail="Terjadwal dan belum berakhir"/>
        <Metric label="Peserta aktif" value={overview.activeMentees} detail="Memiliki sesi mendatang dengan Anda"/>
        <Metric label="Selesai bulan ini" value={overview.completedThisMonth} detail="Berdasarkan status sesi canonical"/>
      </div>
      <div className="mentor-overview-grid">
        <section className="role-card mentor-agenda-card">
          <div className="role-card-heading"><div><p className="kicker">Agenda terdekat</p><h2>Sesi berikutnya</h2></div><button type="button" className="text-link" onClick={() => open('calendar')}>Lihat kalender <CalendarDays aria-hidden="true"/></button></div>
          {overview.upcoming.length ? <div className="mentor-agenda-list">{overview.upcoming.map(session => <article className="mentor-agenda-row" key={session.session_id}><div className="mentor-agenda-time"><strong>{sessionDate(session, data.timezone, false)}</strong><span>{sessionDay(session, data.timezone)}</span></div><div className="mentor-agenda-main"><strong>{session.mentee_name || session.mentee_email || 'Peserta Strativate'}</strong><span>{session.focus_name || 'Fokus mentoring belum dicatat'} · Sesi {session.session_number}/{session.purchased_sessions}</span></div><span className={statusClass(session.status)}>{mentorSessionStatusLabel(session.status)}</span>{session.meeting_url ? <a className="mentor-agenda-link" href={session.meeting_url} target="_blank" rel="noopener noreferrer">Join Meet <ExternalLink aria-hidden="true"/></a> : <button type="button" className="mentor-agenda-link" onClick={() => open('calendar')}>Detail</button>}</article>)}</div> : <EmptyState icon={CalendarDays} title="Belum ada sesi mendatang." detail="Sesi akan muncul setelah admin menjadwalkan Private Mentoring kepada Anda." action={<button type="button" className="button button-outline" onClick={() => open('calendar')}>Buka kalender</button>}/>} 
        </section>
        <section className="role-card mentor-quick-card">
          <p className="kicker">Operasional</p><h2>Akses yang paling sering dibutuhkan.</h2>
          <dl className="mentor-quick-status"><div><dt>Penugasan mendatang</dt><dd>{overview.upcomingSessions} sesi</dd></div><div><dt>Ketersediaan minggu ini</dt><dd><span className={`ops-status ops-status--${availabilityTone(data.availability.current)}`}>{availabilityLabel(data.availability.current)}</span></dd></div><div><dt>Ketersediaan minggu depan</dt><dd><span className={`ops-status ops-status--${availabilityTone(data.availability.next)}`}>{availabilityLabel(data.availability.next)}</span></dd></div></dl>
          <div className="mentor-quick-actions"><button type="button" onClick={() => open('assignments')}><ClipboardList aria-hidden="true"/><span><strong>Lihat penugasan</strong><small>Fokus, sesi, jadwal, dan status.</small></span></button><button type="button" onClick={() => open('mentees')}><UsersRound aria-hidden="true"/><span><strong>Lihat peserta</strong><small>Ringkasan peserta yang Anda dampingi.</small></span></button><button type="button" onClick={() => open('availability')}><Clock3 aria-hidden="true"/><span><strong>Atur ketersediaan</strong><small>Perbarui waktu untuk minggu ini atau berikutnya.</small></span></button></div>
        </section>
      </div>
    </>}
    {data.metadataError ? <p className="mentor-inline-warning" role="status">{data.metadataError}</p> : null}
  </div>
}
