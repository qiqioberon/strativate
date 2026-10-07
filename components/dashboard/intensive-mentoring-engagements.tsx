'use client'

import { CalendarDays, Clock3, ExternalLink, Eye, Layers3, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TablePagination } from '@/components/admin/table-pagination'
import { CopyTextButton } from '@/components/dashboard/copy-text-button'
import { MentoringCompetitionEditor } from '@/components/mentoring/mentoring-competition-editor'
import { MentoringSessionPreferences } from '@/components/mentoring/mentoring-session-preferences'
import type { PrivateMentoringSessionFocusView } from '@/lib/private-mentoring/types'
import type { IntensiveEngagementView, IntensiveSessionView } from '@/lib/intensive-mentoring/types'
import { menteeIntensiveStageLabels, menteeMentoringName, menteeReviewStatus, menteeSessionStatus } from '@/lib/mentoring-presentation'
import styles from './mentee-mentoring.module.css'

function schedule(session: IntensiveSessionView) {
  return session.scheduledStartAt ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.scheduledStartAt)) : 'Not scheduled'
}

export function IntensiveMentoringEngagements({ engagements, sessionFocuses: _sessionFocuses }: { engagements: IntensiveEngagementView[]; sessionFocuses: PrivateMentoringSessionFocusView[] }) {
  const detailRef = useRef<HTMLDialogElement>(null)
  const [selectedEngagementId, setSelectedEngagementId] = useState(engagements[0]?.engagementId ?? '')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const engagement = useMemo(() => engagements.find(item => item.engagementId === selectedEngagementId) ?? engagements[0] ?? null, [engagements, selectedEngagementId])
  const selectedEngagement = useMemo(() => engagements.find(item => item.sessions.some(session => session.sessionId === selectedSessionId)) ?? null, [engagements, selectedSessionId])
  const selectedSession = selectedEngagement?.sessions.find(session => session.sessionId === selectedSessionId) ?? null
  useEffect(() => { if (selectedSessionId && !selectedSession) setSelectedSessionId(null) }, [selectedSession, selectedSessionId])
  useEffect(() => {
    const dialog = detailRef.current
    if (!dialog) return
    if (selectedSession && !dialog.open) dialog.showModal()
    if (!selectedSession && dialog.open) dialog.close()
  }, [selectedSession])
  const sessions = engagement?.sessions ?? []
  const safePage = Math.min(page, Math.max(0, Math.ceil(sessions.length / pageSize) - 1))
  const visible = sessions.slice(safePage * pageSize, safePage * pageSize + pageSize)

  if (!engagements.length) return <section className={`workspace-card ${styles.empty}`}><Layers3 aria-hidden="true" /><h3>No Intensive Mentoring programs yet</h3><p className="muted">Your program will appear once payment is verified.</p></section>

  return <section className={styles.workspace}>
    <ul className={styles.selectorRail} aria-label="Choose an Intensive Mentoring program">{engagements.map(item => <li key={item.engagementId}>
      <button type="button" className={styles.selectorCard} aria-pressed={item.engagementId === engagement?.engagementId} onClick={() => { setSelectedEngagementId(item.engagementId); setPage(0) }} onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}>
        <span className={styles.programType}>Intensive Mentoring</span>
        <strong className={styles.programTitle}>{menteeMentoringName(item.programName)}</strong>
        <span className={styles.cardMeta}><UserRound aria-hidden="true" /><span>{item.primaryMentorName || 'Mentor not assigned'}</span></span>
        <span className={styles.cardStats}><span>{item.baselineSessionsPerMonth ? <><b>{item.baselineSessionsPerMonth}</b> sessions/month</> : 'Custom schedule'}</span><span><b>{item.sessions.length}</b> recorded</span></span>
      </button>
    </li>)}</ul>

    {engagement ? <>
      <section className={`workspace-card ${styles.programDetail}`}>
        <div className={styles.sectionHead}><h3>{menteeMentoringName(engagement.programName)}</h3><div className={styles.inlineStats}><span className={`ops-status ops-status--${engagement.status === 'active' ? 'positive' : 'neutral'}`}>{engagement.status === 'active' ? 'Active' : engagement.status === 'completed' ? 'Completed' : 'Cancelled'}</span><span className="ops-status ops-status--info">{menteeIntensiveStageLabels[engagement.programStage]}</span></div></div>
        <div className={styles.metricGrid}>
          <div><UserRound aria-hidden="true" /><span>Mentor</span><strong>{engagement.primaryMentorName || 'Mentor not assigned'}</strong></div>
          <div><Clock3 aria-hidden="true" /><span>Sessions / month</span><strong>{engagement.baselineSessionsPerMonth ?? 'Custom'}</strong></div>
          <div><Layers3 aria-hidden="true" /><span>Sessions recorded</span><strong>{engagement.sessions.length}</strong></div>
          <div><CalendarDays aria-hidden="true" /><span>Started</span><strong>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(engagement.startedAt))}</strong></div>
        </div>
        <MentoringCompetitionEditor key={engagement.engagementId} kind="intensive" parentId={engagement.engagementId} language="en" compact />
        {engagement.currentActivity ? <div className={styles.progress}><strong>Current activity</strong><p>{engagement.currentActivity}</p></div> : null}
        {engagement.progressSummary ? <div className={styles.progress}><strong>Progress</strong><p>{engagement.progressSummary}</p></div> : null}
        <div className={styles.addons}><strong>Additional support</strong>{engagement.addOns.length ? <div>{engagement.addOns.map(addon => <span key={addon.entitlementId ?? addon.code} className="intensive-addon-chip">{menteeMentoringName(addon.name)}</span>)}</div> : <p className="muted">No additional support included.</p>}</div>
      </section>

      <section className={`workspace-card ${styles.sessionSection}`}>
        <div className={styles.sectionHead}><div><h3>Sessions</h3><p className={styles.resultCount}>{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} recorded</p></div><label className={`ops-field ${styles.pageSize}`}><span>Per page</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5, 10, 20, 50].map(size => <option value={size} key={size}>{size}</option>)}</select></label></div>
        <div className={styles.tableWrap}><table className={styles.sessionTable} data-testid="intensive-session-table">
          <caption className={styles.srOnly}>Intensive Mentoring sessions</caption>
          <colgroup><col className={styles.sessionCol} /><col className={styles.topicCol} /><col className={styles.mentorCol} /><col className={styles.scheduleCol} /><col className={styles.statusCol} /><col className={styles.zoomCol} /><col className={styles.detailCol} /></colgroup>
          <thead><tr><th scope="col">Session</th><th scope="col">Topic / Focus</th><th scope="col">Mentor</th><th scope="col">Schedule</th><th scope="col">Status</th><th scope="col">Zoom</th><th scope="col">Details</th></tr></thead>
          <tbody>{visible.length ? visible.map(session => { const status = menteeSessionStatus(session.status); return <tr key={session.sessionId}>
            <td data-label="Session"><strong>{session.sessionNumber}</strong></td>
            <td data-label="Topic / Focus"><div className={styles.cell}><strong>{session.resolvedTopic || session.focusName || session.menteeTopicRequest || 'Let admin decide'}</strong><small>{menteeReviewStatus(session.topicStatus)}</small></div></td>
            <td data-label="Mentor"><span>{session.mentorName || engagement.primaryMentorName || 'Mentor not assigned'}</span></td>
            <td data-label="Schedule"><span>{schedule(session)}</span></td>
            <td data-label="Status"><span className={`ops-status ops-status--${status.tone}`}>{status.label}</span></td>
            <td data-label="Zoom">{session.status === 'scheduled' && session.meetingUrl ? <a className={`button button-primary ${styles.tableAction}`} href={session.meetingUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open Zoom for session ${session.sessionNumber}`}><ExternalLink aria-hidden="true" />Zoom</a> : <span className="muted">Not available</span>}</td>
            <td data-label="Details"><button type="button" className={`button button-outline ${styles.tableAction}`} onClick={() => setSelectedSessionId(session.sessionId)} aria-label={`View details for session ${session.sessionNumber}`}><Eye aria-hidden="true" />Details</button></td>
          </tr> }) : <tr className={styles.emptyRow}><td colSpan={7}>No sessions have been added yet.</td></tr>}</tbody>
        </table></div>
        <TablePagination page={safePage} pageSize={pageSize} totalItems={sessions.length} onPageChange={setPage} label="Intensive Mentoring session pages" language="en" />
      </section>
    </> : null}

    {selectedSession ? <dialog ref={detailRef} className={`ops-dialog ${styles.detailDialog}`} aria-labelledby="intensive-detail-title" onCancel={event => { event.preventDefault(); setSelectedSessionId(null) }} onClose={() => setSelectedSessionId(null)}>
      <div className={`ops-dialog__surface ${styles.dialogSurface}`}>
        <header className="ops-dialog__header"><div><p className={styles.dialogContext}>Intensive Mentoring</p><h2 id="intensive-detail-title">Session {selectedSession.sessionNumber}</h2></div><button type="button" className="ops-icon-button" onClick={() => setSelectedSessionId(null)} aria-label="Close session details"><X aria-hidden="true" /></button></header>
        <dl className={styles.detailGrid}>
          <div><dt>Program</dt><dd>{menteeMentoringName(selectedEngagement?.programName ?? 'Intensive Mentoring')}</dd></div>
          <div><dt>Status</dt><dd>{menteeSessionStatus(selectedSession.status).label}</dd></div>
          <div><dt>Mentor</dt><dd>{selectedSession.mentorName || selectedEngagement?.primaryMentorName || 'Mentor not assigned'}</dd></div>
          <div><dt>Schedule</dt><dd>{schedule(selectedSession)}</dd></div>
          <div><dt>Duration</dt><dd>{selectedSession.durationMinutes} minutes</dd></div>
          <div><dt>Meeting link</dt><dd>{selectedSession.meetingUrl ? 'Available' : 'Not available'}</dd></div>
        </dl>
        <MentoringSessionPreferences kind="intensive" sessionId={selectedSession.sessionId} role="mentee" />
        <details className="mentoring-audit-details"><summary>Session ID</summary><div className="session-reference-row"><code>{selectedSession.sessionId}</code><CopyTextButton value={selectedSession.sessionId} label="Copy Session ID" language="en" /></div></details>
        {selectedSession.meetingUrl ? <div className={styles.dialogActions}><a className="button button-primary" href={selectedSession.meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Join Zoom</a><CopyTextButton value={selectedSession.meetingUrl} label="Copy Zoom link" language="en" /></div> : null}
      </div>
    </dialog> : null}
  </section>
}
