'use client'

import { ExternalLink, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { MentorMenteeSummary, MentorSessionRow } from '@/lib/mentor/dashboard'
import { detailDate, mentorSessionStatusLabel, sessionDate, statusClass } from './dashboard-ui'

type TopicAwareMentorSession=MentorSessionRow&{resolved_topic?:string|null;mentor_scope_notes?:string|null}

export function SessionDetailDialog({ session, timezone, onClose }: { session: MentorSessionRow | null; timezone: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (session && !dialog.open) dialog.showModal()
    if (!session && dialog.open) dialog.close()
  }, [session])
  const topicSession=session as TopicAwareMentorSession|null

  return <dialog ref={ref} className="ops-dialog mentor-detail-dialog" aria-labelledby="mentor-session-detail-title" onClose={onClose}>
    {session ? <div className="ops-dialog__surface">
      <header className="ops-dialog__header"><div><p className="kicker">Detail sesi</p><h2 id="mentor-session-detail-title">{session.mentee_name || 'Peserta Strativate'} · Sesi {session.session_number}</h2><p>{detailDate(session, timezone)}</p></div><button type="button" className="ops-icon-button" onClick={onClose} aria-label="Tutup detail sesi"><X aria-hidden="true"/></button></header>
      <div className="ops-detail-grid"><div><span>Status</span><strong>{mentorSessionStatusLabel(session.status)}</strong></div><div><span>Topik / goal sesi</span><strong>{topicSession?.resolved_topic || session.focus_name || 'Belum dicatat'}</strong></div><div><span>Paket</span><strong>Private Mentoring · {session.purchased_sessions} sesi</strong></div><div><span>Durasi</span><strong>{session.duration_minutes ? `${session.duration_minutes} menit` : '—'}</strong></div></div>
      {topicSession?.mentor_scope_notes?<section className="ops-dialog__section"><h3>Catatan scope dari admin</h3><p>{topicSession.mentor_scope_notes}</p></section>:null}
      <section className="ops-dialog__section"><h3>Peserta</h3><div className="mentor-dialog-contact"><div><span>Nama</span><strong>{session.mentee_name || 'Peserta Strativate'}</strong></div><div><span>Email</span><strong>{session.mentee_email || 'Tidak tersedia'}</strong></div><div><span>Timezone sesi</span><strong>{session.mentor_timezone || timezone}</strong></div><div><span>Google sync</span><strong>{session.google_sync_status || 'pending'}</strong></div></div></section>
      {session.status === 'scheduled' && session.meeting_url ? <a className="button button-primary" href={session.meeting_url} target="_blank" rel="noopener noreferrer">Join Meeting <ExternalLink aria-hidden="true"/></a> : null}
    </div> : null}
  </dialog>
}

export function MenteeDetailDialog({ summary, timezone, onClose }: { summary: MentorMenteeSummary | null; timezone: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (summary && !dialog.open) dialog.showModal()
    if (!summary && dialog.open) dialog.close()
  }, [summary])

  return <dialog ref={ref} className="ops-dialog mentor-detail-dialog" aria-labelledby="mentor-mentee-detail-title" onClose={onClose}>
    {summary ? <div className="ops-dialog__surface">
      <header className="ops-dialog__header"><div><p className="kicker">Detail peserta</p><h2 id="mentor-mentee-detail-title">{summary.menteeName}</h2><p>{summary.menteeEmail}</p></div><button type="button" className="ops-icon-button" onClick={onClose} aria-label="Tutup detail peserta"><X aria-hidden="true"/></button></header>
      <div className="ops-detail-grid"><div><span>Paket</span><strong>Private Mentoring · {summary.purchasedSessions} sesi</strong></div><div><span>Sesi dialokasikan</span><strong>{summary.assignedSessions}</strong></div><div><span>Selesai</span><strong>{summary.completedSessions}/{summary.progressSessions}</strong></div><div><span>Sesi berikutnya</span><strong>{summary.nextSession ? sessionDate(summary.nextSession, timezone) : 'Belum ada'}</strong></div></div>
      <section className="ops-dialog__section"><h3>Topik mentoring</h3><p>{summary.focusNames.length ? summary.focusNames.join(', ') : 'Belum ada topik yang tercatat pada sesi yang dialokasikan kepada Anda.'}</p></section>
      <section className="ops-dialog__section"><h3>Sesi yang dialokasikan kepada Anda</h3><div className="mentor-dialog-session-list">{summary.sessions.map(session => {const topic=session as TopicAwareMentorSession;return <article key={session.session_id}><div><strong>Sesi {session.session_number}/{session.purchased_sessions}</strong><span>{topic.resolved_topic || session.focus_name || 'Topik belum dicatat'} · {sessionDate(session, timezone)}</span>{topic.mentor_scope_notes?<small>{topic.mentor_scope_notes}</small>:null}</div><span className={statusClass(session.status)}>{mentorSessionStatusLabel(session.status)}</span>{session.status === 'scheduled' && session.meeting_url ? <a href={session.meeting_url} target="_blank" rel="noopener noreferrer" aria-label={`Join Meeting sesi ${session.session_number}`}><ExternalLink aria-hidden="true"/></a> : null}</article>})}</div></section>
    </div> : null}
  </dialog>
}
