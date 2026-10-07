'use client'

import { ExternalLink, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { CopyTextButton } from '@/components/dashboard/copy-text-button'
import { MentoringSessionPreferences } from '@/components/mentoring/mentoring-session-preferences'
import type { MentorMenteeSummary, MentorSessionRow } from '@/lib/mentor/dashboard'
import { detailDate, mentorSessionStatusLabel, sessionDate, statusClass } from './dashboard-ui'
import styles from './mentor-operations.module.css'

type TopicAwareMentorSession = MentorSessionRow & { resolved_topic?: string | null; mentor_scope_notes?: string | null }

export function SessionDetailDialog({ session, timezone, onClose }: { session: MentorSessionRow | null; timezone: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (session && !dialog.open) dialog.showModal()
    if (!session && dialog.open) dialog.close()
  }, [session])
  const topicSession = session as TopicAwareMentorSession | null
  const typeLabel = session?.mentoring_type === 'intensive' ? 'Intensive Mentoring' : 'Private Mentoring'

  return <dialog ref={ref} className={`ops-dialog ${styles.dialog}`} aria-labelledby="mentor-session-detail-title" onClose={onClose}>
    {session ? <div className={`ops-dialog__surface ${styles.dialogSurface}`}>
      <header className={`ops-dialog__header ${styles.dialogHeader}`}><div><p className={styles.dialogContext}>{typeLabel} · Session {session.session_number}{session.purchased_sessions ? `/${session.purchased_sessions}` : ''}</p><h2 id="mentor-session-detail-title">{session.mentee_name || 'Strativate mentee'}</h2><p className={styles.dialogDate}>{detailDate(session, timezone)}</p></div><button type="button" className={`ops-icon-button ${styles.dialogClose}`} onClick={onClose} aria-label="Close session details"><X aria-hidden="true" /></button></header>
      <dl className={styles.detailGrid}>
        <div><dt>Status</dt><dd><span className={statusClass(session.status)}>{mentorSessionStatusLabel(session.status)}</span></dd></div>
        <div><dt>Session focus</dt><dd>{topicSession?.resolved_topic || session.focus_name || 'Not selected'}</dd></div>
        <div><dt>Program</dt><dd>{session.mentoring_type === 'intensive' ? (session.program_name || 'Intensive Mentoring') : `Private Mentoring${session.purchased_sessions ? ` · ${session.purchased_sessions} sessions purchased` : ''}`}</dd></div>
        <div><dt>Duration</dt><dd>{session.duration_minutes ? `${session.duration_minutes} minutes` : 'Not available'}</dd></div>
      </dl>
      <MentoringSessionPreferences kind={session.mentoring_type === 'intensive' ? 'intensive' : 'private'} sessionId={session.session_id} role="mentor" />
      <details className="mentoring-audit-details"><summary>Additional details</summary><div className="session-reference-row"><div><span>Session ID</span><strong>{session.session_id}</strong></div><CopyTextButton value={session.session_id} label="Copy Session ID" copiedLabel="Copied" language="en" /></div></details>
      {session.mentoring_type === 'intensive' && session.add_ons?.length ? <section className={styles.section}><h3>Additional support</h3><p>{session.add_ons.map(item => item.name).join(', ')}</p></section> : null}
      {topicSession?.mentor_scope_notes ? <section className={styles.section}><h3>Admin scope notes</h3><p>{topicSession.mentor_scope_notes}</p></section> : null}
      <section className={styles.section}><h3>Mentee</h3><div className={styles.contactGrid}><div><span>Name</span><strong>{session.mentee_name || 'Strativate mentee'}</strong></div><div><span>Email</span><strong>{session.mentee_email || 'Not available'}</strong></div><div><span>Session time zone</span><strong>{session.mentor_timezone || timezone}</strong></div><div><span>Google sync</span><strong>{session.google_sync_status || 'Not available'}</strong></div></div></section>
      {session.status === 'scheduled' && session.meeting_url ? <div className={styles.dialogActions}><a className="button button-primary" href={session.meeting_url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Join Zoom</a><CopyTextButton value={session.meeting_url} label="Copy Zoom link" copiedLabel="Link copied" language="en" /></div> : null}
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

  return <dialog ref={ref} className={`ops-dialog ${styles.dialog}`} aria-labelledby="mentor-mentee-detail-title" onClose={onClose}>
    {summary ? <div className={`ops-dialog__surface ${styles.dialogSurface}`}>
      <header className={`ops-dialog__header ${styles.dialogHeader}`}><div><p className={styles.dialogContext}>Mentee details</p><h2 id="mentor-mentee-detail-title">{summary.menteeName}</h2><p className={styles.dialogDate}>{summary.menteeEmail || 'Email unavailable'}</p></div><button type="button" className={`ops-icon-button ${styles.dialogClose}`} onClick={onClose} aria-label="Close mentee details"><X aria-hidden="true" /></button></header>
      <dl className={styles.detailGrid}><div><dt>Program</dt><dd>{summary.programName}</dd></div><div><dt>Sessions assigned</dt><dd>{summary.assignedSessions}</dd></div><div><dt>Completed</dt><dd>{summary.completedSessions}/{summary.progressSessions}</dd></div><div><dt>Next session</dt><dd>{summary.nextSession ? sessionDate(summary.nextSession, timezone) : 'No upcoming session'}</dd></div></dl>
      <section className={styles.section}><h3>Mentoring topics</h3><p>{summary.focusNames.length ? summary.focusNames.join(', ') : 'Not recorded'}</p></section>
      <section className={styles.section}><h3>Assigned sessions</h3><div className={styles.sessionList}>{summary.sessions.map(session => { const topic = session as TopicAwareMentorSession; return <article className={styles.sessionRow} key={session.session_id}><div className={styles.sessionRowMain}><strong>Session {session.session_number}{session.purchased_sessions ? `/${session.purchased_sessions}` : ''}</strong><span>{topic.resolved_topic || session.focus_name || 'Not selected'} · {sessionDate(session, timezone)}</span>{topic.mentor_scope_notes ? <small>{topic.mentor_scope_notes}</small> : null}</div><span className={statusClass(session.status)}>{mentorSessionStatusLabel(session.status)}</span>{session.status === 'scheduled' && session.meeting_url ? <div className={styles.meetingActions}><a href={session.meeting_url} target="_blank" rel="noopener noreferrer" aria-label={`Join Zoom for session ${session.session_number}`}><ExternalLink aria-hidden="true" /></a><CopyTextButton value={session.meeting_url} label="Copy Zoom link" copiedLabel="Link copied" language="en" /></div> : null}</article> })}</div></section>
      <details className="mentoring-audit-details"><summary>Additional details</summary><div className={styles.referenceList}>{summary.sessions.map(session => <div className={styles.referenceRow} key={`reference-${session.session_id}`}><div><span>Session {session.session_number} · Session ID</span><code title={session.session_id}>{session.session_id}</code></div><CopyTextButton value={session.session_id} label="Copy Session ID" copiedLabel="Copied" language="en" /></div>)}</div></details>
    </div> : null}
  </dialog>
}
