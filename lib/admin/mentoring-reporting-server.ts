import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { isSalesDate, jakartaDate } from './sales-reporting'
import { MENTORING_KINDS, MENTORING_STATUSES, MENTORING_UUID, mentoringRangeError, type MentoringReportFilters, type MentoringReportPagination } from './mentoring-reporting'

export const MENTORING_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }
export class MentoringReportingError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}
export async function requireMentoringReportAdmin() {
  const client = await createClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new MentoringReportingError('Sign in again to view mentoring reports.', 401)
  const { data: admin, error: adminError } = await client.rpc('is_admin')
  if (adminError || admin !== true) throw new MentoringReportingError('Mentoring reports are only available to administrators.', 403)
  return client
}
export function readMentoringReportRequest(params: URLSearchParams): { filters: MentoringReportFilters; pagination: MentoringReportPagination } {
  const from = params.get('from') || null, to = params.get('to') ?? jakartaDate()
  const rangeError = mentoringRangeError(from, to)
  if (rangeError || (from !== null && !isSalesDate(from))) throw new MentoringReportingError(rangeError || 'Invalid period.')
  const kind = params.get('kind') ?? 'all', status = params.get('status') ?? 'all'
  const mentor = params.get('mentor') ?? 'all', mentee = params.get('mentee') || null, query = params.get('query') ?? ''
  if (!MENTORING_KINDS.some(([value]) => value === kind) || !MENTORING_STATUSES.some(([value]) => value === status) ||
    (mentor !== 'all' && mentor !== 'unassigned' && !MENTORING_UUID.test(mentor)) || (mentee !== null && !MENTORING_UUID.test(mentee)) ||
    query.length > 200 || /[\u0000-\u001f]/u.test(query)) throw new MentoringReportingError('Invalid mentoring report filters.')
  function page(key: string, fallback: number, max: number) {
    const value = Number(params.get(key) ?? fallback)
    if (!Number.isInteger(value) || value < 1 || value > max) throw new MentoringReportingError('Invalid reporting pagination.')
    return value
  }
  return {
    filters: { from, to, kind: kind as MentoringReportFilters['kind'], status: status as MentoringReportFilters['status'], mentor, mentee, query },
    pagination: { sessionPage: page('sessionPage', 1, 1_000_000), mentorPage: page('mentorPage', 1, 1_000_000), menteePage: page('menteePage', 1, 1_000_000), reviewPage: page('reviewPage', 1, 1_000_000), pageSize: page('pageSize', 20, 100) },
  }
}
export function mentoringReportArgs(filters: MentoringReportFilters, pages: MentoringReportPagination) {
  return { p_from: filters.from, p_to: filters.to, p_kind: filters.kind, p_mentor: filters.mentor,
    p_status: filters.status, p_query: filters.query, p_mentee: filters.mentee,
    p_session_page: pages.sessionPage, p_mentor_page: pages.mentorPage, p_mentee_page: pages.menteePage,
    p_review_page: pages.reviewPage, p_page_size: pages.pageSize }
}
export function mentoringReportErrorResponse(error: unknown) {
  return Response.json({ error: error instanceof MentoringReportingError ? error.message : 'Unable to load the mentoring report. Please try again.' },
    { status: error instanceof MentoringReportingError ? error.status : 503, headers: MENTORING_PRIVATE_HEADERS })
}
