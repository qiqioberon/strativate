'use client'

import { BarChart3, CalendarDays } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, type KeyboardEvent } from 'react'
import { MENTORING_UUID } from '@/lib/admin/mentoring-reporting'
import { PrivateMentoringSessionManagement } from './private-mentoring-enrollment-management'
import { IntensiveMentoringSessionManagement } from './intensive-mentoring-session-management'
import { WeeklyMentoringAnalytics } from './weekly-mentoring-analytics'
import styles from './weekly-mentoring.module.css'

type Mode = 'private' | 'intensive'
type View = 'sessions' | 'analytics'
export function AdminMentoringSessionWorkspace({ focusSessionId, focusEnrollmentId, focusEngagementId, focusEntity }: {
  focusSessionId?: string | null; focusEnrollmentId?: string | null; focusEngagementId?: string | null; focusEntity?: string | null
}) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams()
  const notificationKey = `${focusEntity ?? ''}:${focusSessionId ?? focusEnrollmentId ?? focusEngagementId ?? ''}`
  const [consumedNotification, setConsumedNotification] = useState<string | null>(null)
  const notificationActive = consumedNotification !== notificationKey
  const urlSession = params.get('mentoringSession')
  const sessionId = urlSession && MENTORING_UUID.test(urlSession) ? urlSession : notificationActive ? focusSessionId : null
  const entity = params.get('mentoringEntity') ?? (notificationActive ? focusEntity : null)
  const view: View = params.get('mentoringView') === 'analytics' ? 'analytics' : 'sessions'
  const rawMode = params.get('mentoringKind')
  const mode: Mode = rawMode === 'private' || rawMode === 'intensive' ? rawMode : (entity?.startsWith('intensive_') && sessionId) || (notificationActive && focusEngagementId) ? 'intensive' : 'private'
  const privateRef = useRef<HTMLButtonElement>(null), intensiveRef = useRef<HTMLButtonElement>(null)
  const sessionsRef = useRef<HTMLButtonElement>(null), analyticsRef = useRef<HTMLButtonElement>(null)

  function navigate(values: Record<string, string>, push = false) {
    setConsumedNotification(notificationKey)
    const next = new URLSearchParams(params.toString())
    next.delete('reportView'); next.delete('cartView'); next.delete('view'); next.delete('discountView')
    Object.entries(values).forEach(([key, value]) => next.set(key, value))
    if (values.mentoringView === 'analytics' || values.mentoringKind) { next.delete('mentoringSession'); next.delete('mentoringEntity') }
    router[push ? 'push' : 'replace'](`${pathname}?${next}`, { scroll: false })
  }
  function viewKey(event: KeyboardEvent<HTMLButtonElement>, current: View) {
    const next: View | null = event.key === 'Home' ? 'sessions' : event.key === 'End' ? 'analytics' : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? current === 'sessions' ? 'analytics' : 'sessions' : null
    if (!next) return
    event.preventDefault(); navigate({ mentoringView: next }, true)
    requestAnimationFrame(() => (next === 'sessions' ? sessionsRef : analyticsRef).current?.focus())
  }
  function modeKey(event: KeyboardEvent<HTMLButtonElement>, current: Mode) {
    const next: Mode | null = event.key === 'Home' ? 'private' : event.key === 'End' ? 'intensive' : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? current === 'private' ? 'intensive' : 'private' : null
    if (!next) return
    event.preventDefault(); navigate({ mentoringKind: next, mentoringView: 'sessions' })
    requestAnimationFrame(() => (next === 'private' ? privateRef : intensiveRef).current?.focus())
  }
  return <div className={'mentoring-mode-panel ' + styles.sessionWorkspace}>
    <header className="role-page-title"><h2>Mentoring Sessions</h2></header>
    <div className={styles.viewTabs} role="tablist" aria-label="Mentoring workspace view">
      <button ref={sessionsRef} id="admin-mentoring-sessions-tab" type="button" role="tab" aria-selected={view === 'sessions'} aria-controls="admin-mentoring-sessions-panel" tabIndex={view === 'sessions' ? 0 : -1} onKeyDown={event => viewKey(event, 'sessions')} onClick={() => navigate({ mentoringView: 'sessions' }, true)}><CalendarDays size={15}/>Sessions</button>
      <button ref={analyticsRef} id="admin-mentoring-analytics-tab" type="button" role="tab" aria-selected={view === 'analytics'} aria-controls="admin-mentoring-analytics-panel" tabIndex={view === 'analytics' ? 0 : -1} onKeyDown={event => viewKey(event, 'analytics')} onClick={() => navigate({ mentoringView: 'analytics' }, true)}><BarChart3 size={15}/>Weekly Analytics</button>
    </div>
    <section id="admin-mentoring-sessions-panel" role="tabpanel" aria-labelledby="admin-mentoring-sessions-tab" hidden={view !== 'sessions'}>
      {view === 'sessions' ? <>
        <div className="mentoring-mode-tabs" role="tablist" aria-label="Mentoring type">
          <button ref={privateRef} id="admin-mentoring-private-tab" type="button" role="tab" aria-selected={mode === 'private'} aria-controls="admin-mentoring-private-panel" tabIndex={mode === 'private' ? 0 : -1} onKeyDown={event => modeKey(event, 'private')} onClick={() => navigate({ mentoringKind: 'private', mentoringView: 'sessions' })}>Private Mentoring</button>
          <button ref={intensiveRef} id="admin-mentoring-intensive-tab" type="button" role="tab" aria-selected={mode === 'intensive'} aria-controls="admin-mentoring-intensive-panel" tabIndex={mode === 'intensive' ? 0 : -1} onKeyDown={event => modeKey(event, 'intensive')} onClick={() => navigate({ mentoringKind: 'intensive', mentoringView: 'sessions' })}>Intensive Mentoring</button>
        </div>
        <section id="admin-mentoring-private-panel" role="tabpanel" aria-labelledby="admin-mentoring-private-tab" hidden={mode !== 'private'}>{mode === 'private' ? <PrivateMentoringSessionManagement focusSessionId={entity?.startsWith('intensive_') ? null : sessionId} focusEnrollmentId={notificationActive ? focusEnrollmentId : null}/> : null}</section>
        <section id="admin-mentoring-intensive-panel" role="tabpanel" aria-labelledby="admin-mentoring-intensive-tab" hidden={mode !== 'intensive'}>{mode === 'intensive' ? <IntensiveMentoringSessionManagement focusSessionId={entity === 'intensive_mentoring_session' ? sessionId : null} focusEngagementId={notificationActive ? focusEngagementId : null}/> : null}</section>
      </> : null}
    </section>
    <section id="admin-mentoring-analytics-panel" role="tabpanel" aria-labelledby="admin-mentoring-analytics-tab" hidden={view !== 'analytics'}>{view === 'analytics' ? <WeeklyMentoringAnalytics/> : null}</section>
  </div>
}
