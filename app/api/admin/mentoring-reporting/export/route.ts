import { createMentoringWorkbook } from '@/lib/admin/mentoring-reporting-export'
import { MENTORING_PRIVATE_HEADERS, MentoringReportingError, mentoringReportArgs, mentoringReportErrorResponse, readMentoringReportRequest, requireMentoringReportAdmin } from '@/lib/admin/mentoring-reporting-server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  try {
    const client = await requireMentoringReportAdmin()
    const { filters, pagination } = readMentoringReportRequest(new URL(request.url).searchParams)
    const { data, error } = await client.rpc('get_admin_mentoring_report', { ...mentoringReportArgs(filters, pagination), p_export: true })
    if (error?.code === '54000') throw new MentoringReportingError('Exports are limited to 50,000 sessions. Narrow the period or filters.', 413)
    if (error || !data) throw new MentoringReportingError('Unable to prepare the mentoring export. Please try again.', 503)
    const file = await createMentoringWorkbook(data, filters)
    return new Response(new Uint8Array(file), { headers: {
      ...MENTORING_PRIVATE_HEADERS,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="strativate-mentoring-${filters.from ?? 'all'}-${filters.to}.xlsx"`,
      'Content-Length': String(file.byteLength),
    } })
  } catch (error) { return mentoringReportErrorResponse(error) }
}
