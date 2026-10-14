import { MENTORING_PRIVATE_HEADERS, MentoringReportingError, mentoringReportArgs, mentoringReportErrorResponse, readMentoringReportRequest, requireMentoringReportAdmin } from '@/lib/admin/mentoring-reporting-server'

export async function GET(request: Request) {
  try {
    const client = await requireMentoringReportAdmin()
    const params = new URL(request.url).searchParams
    if (params.get('lookup') === 'mentors') {
      const query = params.get('query') ?? ''
      if (query.length > 200 || /[\u0000-\u001f]/u.test(query)) throw new MentoringReportingError('Mentor search is limited to 200 characters.')
      const { data, error } = await client.rpc('search_admin_reporting_mentors', { p_query: query, p_limit: 50 })
      if (error || !data) throw new MentoringReportingError('Unable to load mentors. Please try again.', 503)
      return Response.json(data, { headers: MENTORING_PRIVATE_HEADERS })
    }
    const { filters, pagination } = readMentoringReportRequest(params)
    const { data, error } = await client.rpc('get_admin_mentoring_report', mentoringReportArgs(filters, pagination))
    if (error || !data) throw new MentoringReportingError('Unable to load mentoring sessions. Please try again.', 503)
    return Response.json(data, { headers: MENTORING_PRIVATE_HEADERS })
  } catch (error) { return mentoringReportErrorResponse(error) }
}
