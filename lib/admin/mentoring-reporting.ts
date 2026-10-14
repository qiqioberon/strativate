import { isSalesDate, jakartaDate, shiftDate } from './sales-reporting'

export type MentoringReportKind = 'all' | 'private' | 'intensive'
export type MentoringSessionStatus = 'awaiting_focus' | 'awaiting_scheduling' | 'scheduled' | 'completed' | 'cancelled'
export type MentoringReportFilters = {
  from: string | null; to: string; kind: MentoringReportKind; mentor: string
  status: 'all' | MentoringSessionStatus; query: string; mentee: string | null
}
export type MentoringReportPagination = { sessionPage: number; mentorPage: number; menteePage: number; reviewPage: number; pageSize: number }
export type MentoringReportSession = {
  kind: 'private' | 'intensive'; session_id: string; parent_id: string; mentee_id: string
  mentee_name: string; mentee_email: string | null; mentor_id: string | null; mentor_name: string
  program: string | null; session_number: number; start_at: string | null; end_at: string | null
  duration_minutes: number | null; status: MentoringSessionStatus; topic: string | null
  needs_review: boolean; review_reason: string | null
}
export type MentoringReportSummary = {
  total: number; completed: number; scheduled: number; cancelled: number; unfinished: number
  mentors: number; mentees: number; private_sessions: number; intensive_sessions: number
  needs_review: number; unassigned: number; completion_rate: number
}
type BreakdownCounts = { total: number; completed: number; scheduled: number; cancelled: number; unfinished: number; private_sessions: number; intensive_sessions: number }
export type MentoringMentorBreakdown = BreakdownCounts & { mentor_id: string | null; mentor_name: string; mentees: number }
export type MentoringMenteeBreakdown = BreakdownCounts & { mentee_id: string; mentee_name: string; mentee_email: string | null; mentor_id: string | null; mentor_name: string }
export type MentoringReportPage<T> = { rows: T[]; total_count: number }
export type MentoringReport = {
  range: { from: string | null; to: string; end_exclusive: string; timezone: 'Asia/Jakarta' }
  summary: MentoringReportSummary; top_mentors: MentoringMentorBreakdown[]
  mentors: MentoringReportPage<MentoringMentorBreakdown>; mentees: MentoringReportPage<MentoringMenteeBreakdown>
  sessions: MentoringReportPage<MentoringReportSession>; review: MentoringReportPage<MentoringReportSession>
}
export type MentoringMentorOption = { id: string; name: string }
export const MENTORING_STATUSES: Array<['all' | MentoringSessionStatus, string]> = [
  ['all', 'All statuses'], ['awaiting_focus', 'Awaiting topic'], ['awaiting_scheduling', 'Awaiting scheduling'],
  ['scheduled', 'Scheduled'], ['completed', 'Completed'], ['cancelled', 'Cancelled'],
]
export const MENTORING_KINDS: Array<[MentoringReportKind, string]> = [['all', 'All mentoring'], ['private', 'Private Mentoring'], ['intensive', 'Intensive Mentoring']]
export const MENTORING_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const mentoringStatusLabel = (status: MentoringSessionStatus) => MENTORING_STATUSES.find(([key]) => key === status)?.[1] ?? status
export const mentoringKindLabel = (kind: MentoringReportKind) => MENTORING_KINDS.find(([key]) => key === kind)?.[1] ?? kind

// Calendar arithmetic is UTC only after obtaining the business date in WIB.
export function mentoringWeek(date = jakartaDate()) {
  const value = new Date(`${date}T00:00:00Z`)
  return shiftDate(date, -((value.getUTCDay() + 6) % 7))
}
export function mentoringRangeError(from: string | null, to: string) {
  if ((from !== null && !isSalesDate(from)) || !isSalesDate(to)) return 'Choose valid reporting dates.'
  if (from !== null && from > to) return 'The start date must be on or before the end date.'
  return ''
}
export function mentoringFilters(params: URLSearchParams): MentoringReportFilters {
  const week = params.get('mwWeek') ?? mentoringWeek()
  const rawKind = params.get('mwType') ?? 'all', rawStatus = params.get('mwStatus') ?? 'all'
  const kind = MENTORING_KINDS.some(([key]) => key === rawKind) ? rawKind as MentoringReportKind : 'all'
  const status = MENTORING_STATUSES.some(([key]) => key === rawStatus) ? rawStatus as MentoringReportFilters['status'] : 'all'
  const rawMentor = params.get('mwMentor') ?? 'all', rawMentee = params.get('mwMentee')
  return {
    from: params.has('mwFrom') ? params.get('mwFrom') || null : isSalesDate(week) ? mentoringWeek(week) : week,
    to: params.has('mwTo') ? params.get('mwTo')! : isSalesDate(week) ? shiftDate(mentoringWeek(week), 6) : '',
    kind, status, mentor: rawMentor === 'unassigned' || MENTORING_UUID.test(rawMentor) ? rawMentor : 'all',
    query: (params.get('mwQuery') ?? '').slice(0, 200), mentee: rawMentee && MENTORING_UUID.test(rawMentee) ? rawMentee : null,
  }
}
export function mentoringPagination(params: URLSearchParams): MentoringReportPagination {
  const page = (key: string) => { const value = Number(params.get(key) ?? 1); return Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : 1 }
  const rawSize = Number(params.get('mwPageSize') ?? 20)
  return { sessionPage: page('mwSessionPage'), mentorPage: page('mwMentorPage'), menteePage: page('mwMenteePage'), reviewPage: page('mwReviewPage'), pageSize: [20, 50, 100].includes(rawSize) ? rawSize : 20 }
}
export function mentoringApiParams(filters: MentoringReportFilters, pagination?: MentoringReportPagination) {
  const params = new URLSearchParams({ from: filters.from ?? '', to: filters.to, kind: filters.kind, mentor: filters.mentor, status: filters.status, query: filters.query })
  if (filters.mentee) params.set('mentee', filters.mentee)
  if (pagination) Object.entries(pagination).forEach(([key, value]) => params.set(key, String(value)))
  return params.toString()
}
export function mentoringDetailHref(params: URLSearchParams, row: MentoringReportSession) {
  const next = new URLSearchParams(params)
  if (!next.has('mwWeek') && !next.has('mwFrom')) next.set('mwWeek', mentoringWeek())
  next.delete('reportView'); next.delete('cartView'); next.delete('view'); next.delete('discountView')
  next.set('mentoringView', 'sessions'); next.set('mentoringKind', row.kind)
  next.set('mentoringSession', row.session_id)
  next.set('mentoringEntity', row.kind === 'private' ? 'session' : 'intensive_mentoring_session')
  return `/admin?${next}`
}
export function mentoringAnalyticsHref(from: string | null, to: string, kind: MentoringReportKind = 'all') {
  return `/admin?${new URLSearchParams({ mentoringView: 'analytics', mwFrom: from ?? '', mwTo: to, mwType: kind })}`
}
export function mentoringTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'Unscheduled'
}
