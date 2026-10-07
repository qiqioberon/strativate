'use client'

import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  ExternalLink,
  UsersRound,
} from 'lucide-react'
import { useMemo } from 'react'

import {
  buildMentorOverview,
  mentorSessionStatusTone,
  type MentorDashboardData,
  type MentorSessionRow,
  type MentorSessionStatus,
} from '@/lib/mentor/dashboard'
import styles from '../mentor-shell-overview.module.css'

export type MentorDashboardSection = 'overview' | 'calendar' | 'assignments' | 'mentees' | 'availability' | 'history' | 'notifications' | 'profile'

const sessionStatusLabels: Record<MentorSessionStatus, string> = {
  awaiting_focus: 'Awaiting review',
  awaiting_scheduling: 'Awaiting scheduling',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function sessionTime(session: MentorSessionRow, timezone: string) {
  if (!session.scheduled_start_at) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: session.mentor_timezone || timezone,
  }).format(new Date(session.scheduled_start_at))
}

function sessionDay(session: MentorSessionRow, timezone: string) {
  if (!session.scheduled_start_at) return 'Date not set'
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: session.mentor_timezone || timezone,
  }).format(new Date(session.scheduled_start_at))
}

function availabilityLabel(value: boolean | null) {
  return value ? 'Set' : 'Not set'
}

export function MentorOverview({
  name,
  data,
  open,
  onRetry,
}: {
  name: string
  data: MentorDashboardData
  open: (section: MentorDashboardSection) => void
  onRetry: () => void
}) {
  const overview = useMemo(
    () => buildMentorOverview(data.sessions, new Date(), data.timezone),
    [data.sessions, data.timezone],
  )

  return <div className={styles.overview}>
    <header className={styles.overviewHeader}>
      <h1>Welcome back, {name}.</h1>
      <button type="button" className={"button button-primary " + styles.availabilityAction} onClick={() => open('availability')}>
        <Clock3 aria-hidden="true" />
        Set availability
      </button>
    </header>

    {data.sessionError ? (
      <section className={styles.errorState} role="alert">
        <strong>Mentor data could not be loaded.</strong>
        <p>Please refresh and try again.</p>
        <button type="button" className="button button-outline" onClick={onRetry}>Try again</button>
      </section>
    ) : <>
      <div className={styles.metrics} aria-label="Mentor overview">
        <button type="button" className={styles.metric} data-tone="orange" onClick={() => open('calendar')}>
          <span className={styles.metricLabel}>Sessions today</span>
          <strong>{overview.sessionsToday}</strong>
          <span className={styles.metricIcon}><CalendarDays aria-hidden="true" /></span>
          <small>On your local date</small>
        </button>
        <button type="button" className={styles.metric} data-tone="amber" onClick={() => open('calendar')}>
          <span className={styles.metricLabel}>Upcoming sessions</span>
          <strong>{overview.upcomingSessions}</strong>
          <span className={styles.metricIcon}><Clock3 aria-hidden="true" /></span>
          <small>Scheduled ahead</small>
        </button>
        <button type="button" className={styles.metric} data-tone="coral" onClick={() => open('mentees')}>
          <span className={styles.metricLabel}>Active mentees</span>
          <strong>{overview.activeMentees}</strong>
          <span className={styles.metricIcon}><UsersRound aria-hidden="true" /></span>
          <small>With upcoming sessions</small>
        </button>
        <button type="button" className={styles.metric} data-tone="positive" onClick={() => open('history')}>
          <span className={styles.metricLabel}>Completed this month</span>
          <strong>{overview.completedThisMonth}</strong>
          <span className={styles.metricIcon}><CheckCircle2 aria-hidden="true" /></span>
          <small>Finished this month</small>
        </button>
      </div>

      <div className={styles.overviewGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Upcoming sessions</h2>
            <button type="button" className={"button button-outline " + styles.secondaryAction} onClick={() => open('calendar')}>
              <CalendarDays aria-hidden="true" />
              View calendar
            </button>
          </div>

          {overview.upcoming.length ? (
            <div className={styles.sessionList}>
              {overview.upcoming.map(session => (
                <article className={styles.sessionRow} key={session.session_id}>
                  <div className={styles.sessionTime}>
                    <strong>{sessionTime(session, data.timezone)}</strong>
                    <span>{sessionDay(session, data.timezone)}</span>
                  </div>
                  <div className={styles.sessionMain}>
                    <strong>{session.mentee_name || session.mentee_email || 'Strativate mentee'}</strong>
                    <span>
                      {session.mentoring_type === 'intensive'
                        ? 'Intensive · ' + (session.program_name || 'Program')
                        : 'Private Mentoring'}
                      {' · '}
                      {session.resolved_topic || session.focus_name || 'Focus not set'}
                      {' · Session '}
                      {session.session_number}
                      {session.purchased_sessions ? '/' + session.purchased_sessions : ''}
                    </span>
                  </div>
                  <span className={"ops-status ops-status--" + mentorSessionStatusTone(session.status) + " " + styles.sessionStatus}>
                    {sessionStatusLabels[session.status]}
                  </span>
                  {session.meeting_url ? (
                    <a className={styles.sessionAction} href={session.meeting_url} target="_blank" rel="noopener noreferrer">
                      Join Zoom
                      <ExternalLink aria-hidden="true" />
                    </a>
                  ) : (
                    <button type="button" className={styles.sessionAction} onClick={() => open('calendar')}>Details</button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <CalendarDays aria-hidden="true" />
              <p>No upcoming sessions.</p>
            </div>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Quick access</h2>
          </div>

          <dl className={styles.quickStatus}>
            <div>
              <dt>Upcoming assignments</dt>
              <dd>{overview.upcomingSessions} sessions</dd>
            </div>
            <div>
              <dt>Availability this week</dt>
              <dd>{availabilityLabel(data.availability.current)}</dd>
            </div>
            <div>
              <dt>Availability next week</dt>
              <dd>{availabilityLabel(data.availability.next)}</dd>
            </div>
          </dl>

          <div className={styles.quickActions}>
            <button type="button" onClick={() => open('assignments')}>
              <span className={styles.quickIcon}><ClipboardList aria-hidden="true" /></span>
              <span><strong>View assignments</strong><small>Focus and upcoming sessions</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
            <button type="button" onClick={() => open('mentees')}>
              <span className={styles.quickIcon}><UsersRound aria-hidden="true" /></span>
              <span><strong>View mentees</strong><small>Mentees you currently support</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
            <button type="button" onClick={() => open('availability')}>
              <span className={styles.quickIcon}><Clock3 aria-hidden="true" /></span>
              <span><strong>Set availability</strong><small>Update weekly availability</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </>}

    {data.metadataError ? <p className={styles.inlineWarning} role="status">Some mentor details are temporarily unavailable.</p> : null}
  </div>
}
