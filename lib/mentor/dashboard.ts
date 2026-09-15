export type MentorSessionStatus = 'awaiting_focus' | 'awaiting_scheduling' | 'scheduled' | 'completed' | 'cancelled'

export type MentorSessionRow = {
  session_id: string
  enrollment_id: string
  mentee_id: string
  mentee_name: string | null
  mentee_email: string
  session_number: number
  purchased_sessions: number
  status: MentorSessionStatus
  focus_name: string | null
  scheduled_start_at: string | null
  scheduled_end_at: string | null
  mentor_timezone: string | null
  duration_minutes: number
  meeting_url: string | null
  google_event_id: string | null
  google_ical_uid: string | null
  google_sync_status: string
}

export type MentorAvailabilityState = {
  current: boolean | null
  next: boolean | null
}

export type MentorDashboardData = {
  sessions: MentorSessionRow[]
  tierName: string | null
  timezone: string
  isActive: boolean
  availability: MentorAvailabilityState
  sessionError: string | null
  metadataError: string | null
}

export type MentorOverviewData = {
  sessionsToday: number
  upcomingSessions: number
  activeMentees: number
  completedThisMonth: number
  upcoming: MentorSessionRow[]
}

export type MentorMenteeSummary = {
  enrollmentId: string
  menteeId: string
  menteeName: string
  menteeEmail: string
  purchasedSessions: number
  assignedSessions: number
  progressSessions: number
  completedSessions: number
  cancelledSessions: number
  focusNames: string[]
  nextSession: MentorSessionRow | null
  latestSessionAt: string | null
  sessions: MentorSessionRow[]
}

function timeValue(value: string | null, fallback: number) {
  if (!value) return fallback
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : fallback
}

function dateParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return { year: byType.year, month: byType.month, day: byType.day }
}

function dateKey(value: Date, timezone: string) {
  const parts = dateParts(value, timezone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

function monthKey(value: Date, timezone: string) {
  const parts = dateParts(value, timezone)
  return `${parts.year}-${parts.month}`
}

export function mentorSessionStatusLabel(status: MentorSessionStatus) {
  if (status === 'awaiting_focus') return 'Menunggu fokus'
  if (status === 'awaiting_scheduling') return 'Menunggu jadwal'
  if (status === 'scheduled') return 'Terjadwal'
  if (status === 'completed') return 'Selesai'
  return 'Dibatalkan'
}

export function mentorSessionStatusTone(status: MentorSessionStatus) {
  if (status === 'completed') return 'positive'
  if (status === 'scheduled') return 'info'
  if (status === 'cancelled') return 'danger'
  return 'warning'
}

export function isUpcomingMentorSession(session: MentorSessionRow, now: Date) {
  if (session.status !== 'scheduled' || !session.scheduled_start_at) return false
  const boundary = session.scheduled_end_at || session.scheduled_start_at
  return timeValue(boundary, Number.NEGATIVE_INFINITY) >= now.getTime()
}

export function buildMentorOverview(sessions: MentorSessionRow[], now = new Date(), timezone = 'Asia/Jakarta'): MentorOverviewData {
  const today = dateKey(now, timezone)
  const month = monthKey(now, timezone)
  const upcoming = sessions
    .filter(session => isUpcomingMentorSession(session, now))
    .sort((left, right) => timeValue(left.scheduled_start_at, Number.MAX_SAFE_INTEGER) - timeValue(right.scheduled_start_at, Number.MAX_SAFE_INTEGER))

  const sessionsToday = sessions.filter(session => {
    if (session.status === 'cancelled' || !session.scheduled_start_at) return false
    return dateKey(new Date(session.scheduled_start_at), timezone) === today
  }).length

  const completedThisMonth = sessions.filter(session => {
    if (session.status !== 'completed' || !session.scheduled_start_at) return false
    return monthKey(new Date(session.scheduled_start_at), timezone) === month
  }).length

  return {
    sessionsToday,
    upcomingSessions: upcoming.length,
    activeMentees: new Set(upcoming.map(session => session.mentee_id)).size,
    completedThisMonth,
    upcoming: upcoming.slice(0, 5),
  }
}

export function buildMentorMenteeSummaries(sessions: MentorSessionRow[], now = new Date()): MentorMenteeSummary[] {
  const grouped = new Map<string, MentorSessionRow[]>()
  for (const session of sessions) {
    const current = grouped.get(session.enrollment_id) || []
    current.push(session)
    grouped.set(session.enrollment_id, current)
  }

  return [...grouped.entries()].map(([enrollmentId, rows]) => {
    const ordered = [...rows].sort((left, right) => left.session_number - right.session_number)
    const first = ordered[0]
    const upcoming = ordered
      .filter(session => isUpcomingMentorSession(session, now))
      .sort((left, right) => timeValue(left.scheduled_start_at, Number.MAX_SAFE_INTEGER) - timeValue(right.scheduled_start_at, Number.MAX_SAFE_INTEGER))
    const focusNames = [...new Set(ordered.map(session => session.focus_name?.trim()).filter((value): value is string => Boolean(value)))]
    const dated = ordered.filter(session => session.scheduled_start_at)
    const latestSession = dated.sort((left, right) => timeValue(right.scheduled_start_at, Number.NEGATIVE_INFINITY) - timeValue(left.scheduled_start_at, Number.NEGATIVE_INFINITY))[0]

    return {
      enrollmentId,
      menteeId: first.mentee_id,
      menteeName: first.mentee_name?.trim() || first.mentee_email || 'Peserta Strativate',
      menteeEmail: first.mentee_email,
      purchasedSessions: first.purchased_sessions,
      assignedSessions: ordered.length,
      progressSessions: ordered.filter(session => session.status !== 'cancelled').length,
      completedSessions: ordered.filter(session => session.status === 'completed').length,
      cancelledSessions: ordered.filter(session => session.status === 'cancelled').length,
      focusNames,
      nextSession: upcoming[0] || null,
      latestSessionAt: latestSession?.scheduled_start_at || null,
      sessions: ordered,
    }
  })
}

export function historyMentorSessions(sessions: MentorSessionRow[]) {
  return sessions
    .filter(session => session.status === 'completed' || session.status === 'cancelled')
    .sort((left, right) => timeValue(right.scheduled_start_at, Number.NEGATIVE_INFINITY) - timeValue(left.scheduled_start_at, Number.NEGATIVE_INFINITY))
}
