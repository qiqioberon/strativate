import 'server-only'
import { PassThrough } from 'node:stream'
import ExcelJS, { type Worksheet } from 'exceljs'
import { salesExportDate, sanitizeSalesExportText } from './sales-export'
import { mentoringKindLabel, mentoringStatusLabel, type MentoringReport, type MentoringReportFilters, type MentoringReportSession } from './mentoring-reporting'
import { MentoringReportingError } from './mentoring-reporting-server'

const MAX_FILE_BYTES = 64 * 1024 * 1024
type Cell = string | number | Date | null
function safe(value: Cell): Cell {
  if (typeof value !== 'string') return value
  const result = sanitizeSalesExportText(value)
  if (result.length > 32_767) throw new MentoringReportingError('A session field exceeds the Excel cell limit. Contact the data administrator.', 422)
  return result
}
function addRow(sheet: Worksheet, values: Cell[]) {
  const row = sheet.addRow(values.map(safe))
  values.forEach((value, index) => { if (value instanceof Date) row.getCell(index + 1).numFmt = 'dd/mm/yyyy hh:mm' })
  row.commit()
}
function sheet(workbook: ExcelJS.stream.xlsx.WorkbookWriter, name: string, headers: string[]) {
  const result = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  result.columns = headers.map(header => ({ width: /name|mentee|mentor|program|topic|reason|email/i.test(header) ? 32 : 23 }))
  const heading = result.addRow(headers.map(safe))
  heading.height = 28
  heading.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FF292929' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F1ED' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  heading.commit()
  return result
}
function sessionValues(row: MentoringReportSession): Cell[] {
  return [row.mentee_name, row.mentee_email, row.mentee_id, row.mentor_name, row.mentor_id,
    mentoringKindLabel(row.kind), row.program, row.session_number, salesExportDate(row.start_at), salesExportDate(row.end_at),
    row.duration_minutes, mentoringStatusLabel(row.status), row.status, row.topic, row.review_reason, row.kind, row.session_id, row.parent_id]
}
export async function createMentoringWorkbook(report: MentoringReport, filters: MentoringReportFilters) {
  // SQL returns a single bounded snapshot; all sheets use those same canonical records.
  if (report.sessions.total_count !== report.sessions.rows.length || report.review.total_count !== report.review.rows.length ||
    report.mentors.total_count !== report.mentors.rows.length || report.mentees.total_count !== report.mentees.rows.length ||
    report.sessions.total_count + report.review.total_count > 50_000) {
    throw new MentoringReportingError('Export data is incomplete or exceeds 50,000 sessions. Narrow the period or filters.', 413)
  }
  const stream = new PassThrough(), chunks: Buffer[] = []
  let bytes = 0, tooLarge = false
  const completed = new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > MAX_FILE_BYTES) tooLarge = true; else chunks.push(chunk) })
    stream.once('end', () => tooLarge ? reject(new MentoringReportingError('The export exceeds 64 MB. Narrow the period or filters.', 413)) : resolve(Buffer.concat(chunks)))
    stream.once('error', reject)
  })
  void completed.catch(() => {})
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true, useSharedStrings: false })
  workbook.creator = 'Strativate'; workbook.created = new Date()
  try {
    const summary = sheet(workbook, 'Summary', ['Metric / filter', 'Value'])
    const metricRows: Array<[string, Cell]> = [
      ['Period from (inclusive, WIB)', report.range.from ?? 'All time'], ['Period to (inclusive, WIB)', report.range.to],
      ['Period end (exclusive, WIB)', report.range.end_exclusive], ['Mentoring type', mentoringKindLabel(filters.kind)],
      ['Mentor filter (UUID)', filters.mentor], ['Status filter', filters.status], ['Mentee search', filters.query || 'All'],
      ['Mentee filter (UUID)', filters.mentee], ['Generated (WIB)', salesExportDate(new Date().toISOString())],
      ['Dated session records', report.summary.total], ['Completed sessions', report.summary.completed],
      ['Scheduled sessions', report.summary.scheduled], ['Unfinished sessions', report.summary.unfinished],
      ['Cancelled sessions', report.summary.cancelled], ['Completion rate (%)', report.summary.completion_rate],
      ['Completion denominator', 'All dated sessions except cancelled sessions'],
      ['Mentors with sessions', report.summary.mentors], ['Distinct mentees', report.summary.mentees],
      ['Private sessions', report.summary.private_sessions], ['Intensive sessions', report.summary.intensive_sessions],
      ['Dated sessions needing review', report.summary.needs_review], ['Unassigned dated sessions', report.summary.unassigned],
      ['Undated sessions needing review', report.review.total_count],
      ['Undated coverage', 'Undated records match the type, mentor, status and mentee filters across all dates; excluded from period totals.'],
      ['Attribution', 'Current scheduled start in Asia/Jakarta; canonical current status and per-session mentor.'],
    ]
    for (const row of metricRows) addRow(summary, row)
    summary.commit()
    const mentors = sheet(workbook, 'Sessions by Mentor', ['Mentor', 'Mentor UUID', 'Total', 'Completed', 'Scheduled', 'Unfinished', 'Cancelled', 'Distinct mentees', 'Private', 'Intensive'])
    for (const row of report.mentors.rows) addRow(mentors, [row.mentor_name, row.mentor_id, row.total, row.completed, row.scheduled, row.unfinished, row.cancelled, row.mentees, row.private_sessions, row.intensive_sessions])
    mentors.commit()
    const mentees = sheet(workbook, 'Sessions by Mentee', ['Mentee', 'Email', 'Mentee UUID', 'Mentor', 'Mentor UUID', 'Total', 'Completed', 'Scheduled', 'Unfinished', 'Cancelled', 'Private', 'Intensive'])
    for (const row of report.mentees.rows) addRow(mentees, [row.mentee_name, row.mentee_email, row.mentee_id, row.mentor_name, row.mentor_id, row.total, row.completed, row.scheduled, row.unfinished, row.cancelled, row.private_sessions, row.intensive_sessions])
    mentees.commit()
    const headers = ['Mentee', 'Mentee email', 'Mentee UUID', 'Mentor', 'Mentor UUID', 'Mentoring type', 'Program / package', 'Session number', 'Start (WIB)', 'End (WIB)', 'Duration (minutes)', 'Status', 'Canonical status', 'Topic', 'Review reason', 'Kind', 'Session UUID', 'Parent UUID']
    for (const [name, rows] of [['Session Details', report.sessions.rows], ['Unscheduled - Needs Review', report.review.rows]] as const) {
      const details = sheet(workbook, name, headers)
      for (let index = 0; index < rows.length; index++) {
        addRow(details, sessionValues(rows[index]))
        if (index % 500 === 0) await new Promise<void>(resolve => setImmediate(resolve))
      }
      details.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: headers.length } }
      details.commit()
    }
    const [, result] = await Promise.all([workbook.commit(), completed])
    return result
  } catch (error) { stream.destroy(); throw error }
}
