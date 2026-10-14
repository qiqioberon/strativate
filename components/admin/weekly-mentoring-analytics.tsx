'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Download, RefreshCw, Search, X } from 'lucide-react'
import { count, displayDate, isSalesDate, shiftDate } from '@/lib/admin/sales-reporting'
import { MENTORING_KINDS, MENTORING_STATUSES, mentoringApiParams, mentoringFilters, mentoringPagination, mentoringWeek, type MentoringMentorOption } from '@/lib/admin/mentoring-reporting'
import { useWeeklyMentoringReport } from './weekly-mentoring-report-hook'
import { WeeklyMentoringKpis } from './weekly-mentoring-summary'
import { WeeklyMentoringPagination, WeeklyMentoringSessionTable } from './weekly-mentoring-tables'
import styles from './weekly-mentoring.module.css'

const PAGE_KEYS = ['mwSessionPage', 'mwMentorPage', 'mwMenteePage', 'mwReviewPage']
export function WeeklyMentoringAnalytics() {
  const router = useRouter(), pathname = usePathname(), searchParams = useSearchParams()
  const params = new URLSearchParams(searchParams.toString()), filters = mentoringFilters(params), pages = mentoringPagination(params)
  const { report, loading, error, refresh } = useWeeklyMentoringReport(filters, pages)
  const [mentorSearch, setMentorSearch] = useState(''), [mentorOptions, setMentorOptions] = useState<MentoringMentorOption[]>([]), [mentorError, setMentorError] = useState('')
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('')
  const detailsRef = useRef<HTMLElement>(null)
  const [drilldownFocus, setDrilldownFocus] = useState<string | null>(null)
  const exportController = useRef<AbortController | null>(null), downloadUrl = useRef<string | null>(null)
  const week = filters.from && isSalesDate(filters.from) ? mentoringWeek(filters.from) : mentoringWeek()
  const currentMentor = report?.mentors.rows.find(row => row.mentor_id === filters.mentor)
  const selectedMentor = mentorOptions.find(row => row.id === filters.mentor) ?? (currentMentor ? { id: filters.mentor, name: currentMentor.mentor_name } : null)
  const requestKey = mentoringApiParams(filters, pages)

  function update(values: Record<string, string | null>, resetPages = true) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('reportView'); next.delete('cartView'); next.delete('view'); next.delete('discountView')
    next.set('mentoringView', 'analytics')
    if (!next.has('mwWeek') && !next.has('mwFrom')) next.set('mwWeek', week)
    if (resetPages) PAGE_KEYS.forEach(key => next.delete(key))
    Object.entries(values).forEach(([key, value]) => value === null ? next.delete(key) : next.set(key, value))
    router.replace(`${pathname}?${next}`, { scroll: false })
  }
  function selectWeek(value: string) {
    if (!isSalesDate(value)) { update({ mwWeek: value, mwFrom: null, mwTo: null }); return }
    update({ mwWeek: mentoringWeek(value), mwFrom: null, mwTo: null })
  }
  function showSessions(mentor: string | null, mentee: string | null = null) {
    const nextFilters = { ...filters, mentor: mentor ?? 'unassigned', mentee }
    setDrilldownFocus(mentoringApiParams(nextFilters, { ...pages, sessionPage: 1, mentorPage: 1, menteePage: 1, reviewPage: 1 }))
    update({ mwMentor: nextFilters.mentor, mwMentee: mentee })
  }
  useEffect(() => {
    if (!loading && report && drilldownFocus === requestKey) {
      detailsRef.current?.focus({ preventScroll: true })
      detailsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      setDrilldownFocus(null)
    }
  }, [loading, report, drilldownFocus, requestKey])
  useEffect(() => {
    if (loading || !report) return
    const targets: Array<[string, number, number]> = [
      ['mwSessionPage', pages.sessionPage, report.sessions.total_count],
      ['mwMentorPage', pages.mentorPage, report.mentors.total_count],
      ['mwMenteePage', pages.menteePage, report.mentees.total_count],
      ['mwReviewPage', pages.reviewPage, report.review.total_count],
    ]
    const next = new URLSearchParams(searchParams.toString())
    let changed = false
    for (const [key, page, total] of targets) {
      const lastPage = Math.max(1, Math.ceil(total / pages.pageSize))
      if (page > lastPage) { next.set(key, String(lastPage)); changed = true }
    }
    if (changed) router.replace(`${pathname}?${next}`, { scroll: false })
  }, [loading, report, pages.sessionPage, pages.mentorPage, pages.menteePage, pages.reviewPage, pages.pageSize, searchParams, pathname, router])
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/mentoring-reporting?${new URLSearchParams({ lookup: 'mentors', query: mentorSearch })}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('Unable to load mentor options.')
        const rows: MentoringMentorOption[] = await response.json()
        if (!controller.signal.aborted) { setMentorOptions(rows); setMentorError('') }
      } catch (cause) { if (!controller.signal.aborted) setMentorError(cause instanceof Error ? cause.message : 'Unable to load mentors.') }
    }, 250)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [mentorSearch])
  useEffect(() => () => { exportController.current?.abort(); if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current) }, [])

  async function exportReport() {
    const controller = new AbortController(); exportController.current = controller
    setExporting(true); setExportError('')
    try {
      const response = await fetch(`/api/admin/mentoring-reporting/export?${mentoringApiParams(filters)}`, { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) { const body: { error?: string } = await response.json(); throw new Error(body.error || 'Unable to export mentoring sessions.') }
      const file = await response.blob()
      if (controller.signal.aborted) return
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current)
      const url = URL.createObjectURL(file); downloadUrl.current = url
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `strativate-mentoring-${filters.from ?? 'all'}-${filters.to}.xlsx`
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      setTimeout(() => { URL.revokeObjectURL(url); if (downloadUrl.current === url) downloadUrl.current = null }, 30_000)
    } catch (cause) { if (!controller.signal.aborted) setExportError(cause instanceof Error ? cause.message : 'Unable to export the report.') }
    finally { if (!controller.signal.aborted) setExporting(false) }
  }

  return <div className={styles.workspace} aria-busy={loading}>
    <div className={styles.toolbar}><div className={styles.weekControls}>
      <button type="button" disabled={week <= '0001-01-01'} onClick={() => selectWeek(shiftDate(week, -7))} aria-label="Previous week"><ChevronLeft size={16}/></button>
      <button type="button" onClick={() => selectWeek(mentoringWeek())}>Current week</button>
      <button type="button" disabled={week >= '9999-12-20'} onClick={() => selectWeek(shiftDate(week, 7))} aria-label="Next week"><ChevronRight size={16}/></button>
      <label>Week of<input aria-label="Choose a week" type="date" min="0001-01-01" max="9999-12-24" value={week} onChange={event => selectWeek(event.target.value)}/></label>
    </div><div className={styles.actions}><button type="button" onClick={refresh} disabled={loading} aria-label="Refresh weekly report"><RefreshCw size={15}/></button><button type="button" onClick={() => void exportReport()} disabled={exporting || !!error || loading || !report}><Download size={15}/>{exporting ? 'Exporting…' : 'Export Weekly Report'}</button></div></div>
    <p className={styles.range}>{filters.from && isSalesDate(filters.from) ? displayDate(filters.from) : 'All time'} – {isSalesDate(filters.to) ? displayDate(filters.to) : 'Choose an end date'} <span>WIB · end date inclusive</span></p>
    <div className={styles.filters}>
      <label className={styles.search}>Find mentee<div><Search size={15}/><input value={filters.query} maxLength={200} placeholder="Name, email or session reference" onChange={event => update({ mwQuery: event.target.value, mwMentee: null })}/></div></label>
      <label>Mentoring type<select value={filters.kind} onChange={event => update({ mwType: event.target.value })}>{MENTORING_KINDS.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label>Session status<select value={filters.status} onChange={event => update({ mwStatus: event.target.value })}>{MENTORING_STATUSES.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label>Find mentor<input value={mentorSearch} maxLength={200} placeholder="Search mentor name" onChange={event => setMentorSearch(event.target.value)}/></label>
      <label>Mentor<select value={filters.mentor} onChange={event => update({ mwMentor: event.target.value, mwMentee: null })}><option value="all">All mentors</option><option value="unassigned">Unassigned</option>{filters.mentor !== 'all' && filters.mentor !== 'unassigned' && !mentorOptions.some(row => row.id === filters.mentor) && <option value={filters.mentor}>{selectedMentor?.name || `Mentor ${filters.mentor.slice(0, 8)}`}</option>}{mentorOptions.map(row => <option key={row.id} value={row.id}>{row.name} · {row.id.slice(0, 8)}</option>)}</select></label>
    </div>
    {mentorError && <p className={styles.error} role="alert">{mentorError}</p>}
    {mentorOptions.length === 50 && <p className={styles.note}>Showing 50 matching mentors. Refine the mentor search to find a name.</p>}
    {(filters.mentee || filters.mentor !== 'all') && <div className={styles.distribution}><span>Showing {filters.mentee ? 'a selected mentee / mentor pair' : 'a selected mentor'}</span><button type="button" onClick={() => update({ mwMentee: null, mwMentor: 'all' })}><X size={14}/>Clear drilldown</button></div>}
    {exportError && <p className={styles.error} role="alert">{exportError}</p>}
    {error ? <div className={styles.error} role="alert">{error}<button type="button" onClick={refresh}>Retry</button></div> : loading && !report ? <p className={styles.empty} role="status">Loading mentoring sessions…</p> : report ? <>
      <WeeklyMentoringKpis summary={report.summary}/>
      <div className={styles.distribution}><span>Private: <strong>{count(report.summary.private_sessions)}</strong></span><span>Intensive: <strong>{count(report.summary.intensive_sessions)}</strong></span><span>Scheduled: <strong>{count(report.summary.scheduled)}</strong></span><span>Dated sessions needing review: <strong>{count(report.summary.needs_review)}</strong></span><label>Rows per page<select value={pages.pageSize} onChange={event => update({ mwPageSize: event.target.value })}>{[20, 50, 100].map(value => <option value={value} key={value}>{value}</option>)}</select></label></div>
      <section ref={detailsRef} tabIndex={-1} aria-label="Mentee-first session details" className={styles.section}><div className={styles.sectionHeading}><h3>Mentee-first session details</h3></div><WeeklyMentoringSessionTable rows={report.sessions.rows} params={params} empty="No dated sessions match this period and filters."/><WeeklyMentoringPagination page={pages.sessionPage} pageSize={pages.pageSize} total={report.sessions.total_count} label="sessions" onPage={value => update({ mwSessionPage: String(value) }, false)}/></section>
      <section className={styles.section}><div className={styles.sectionHeading}><h3>Sessions by Mentor</h3></div><div className={styles.tableScroll} tabIndex={0} aria-label="Sessions by mentor"><table className={styles.table}><thead><tr><th>Mentor</th><th>Total</th><th>Completed</th><th>Scheduled</th><th>Cancelled</th><th>Mentees</th><th>Private / Intensive</th><th>Sessions</th></tr></thead><tbody>{report.mentors.rows.map(row => <tr key={row.mentor_id ?? 'unassigned'}><td><strong>{row.mentor_name}</strong>{row.mentor_id && <small>{row.mentor_id.slice(0, 8)}</small>}</td><td>{count(row.total)}</td><td>{count(row.completed)}</td><td>{count(row.scheduled)}</td><td>{count(row.cancelled)}</td><td>{count(row.mentees)}</td><td>{count(row.private_sessions)} / {count(row.intensive_sessions)}</td><td><button type="button" onClick={() => showSessions(row.mentor_id)}>View sessions</button></td></tr>)}{!report.mentors.rows.length && <tr><td colSpan={8} className={styles.empty}>No mentors with dated sessions.</td></tr>}</tbody></table></div><WeeklyMentoringPagination page={pages.mentorPage} pageSize={pages.pageSize} total={report.mentors.total_count} label="mentors" onPage={value => update({ mwMentorPage: String(value) }, false)}/></section>
      <section className={styles.section}><div className={styles.sectionHeading}><h3>Sessions by Mentee</h3></div><div className={styles.tableScroll} tabIndex={0} aria-label="Sessions by mentee and mentor"><table className={styles.table}><thead><tr><th>Mentee</th><th>Mentor</th><th>Total</th><th>Completed</th><th>Scheduled</th><th>Cancelled</th><th>Private / Intensive</th><th>Sessions</th></tr></thead><tbody>{report.mentees.rows.map(row => <tr key={`${row.mentee_id}:${row.mentor_id ?? 'unassigned'}`}><td><strong>{row.mentee_name}</strong><small>{row.mentee_email || row.mentee_id.slice(0, 8)}</small></td><td>{row.mentor_name}</td><td>{count(row.total)}</td><td>{count(row.completed)}</td><td>{count(row.scheduled)}</td><td>{count(row.cancelled)}</td><td>{count(row.private_sessions)} / {count(row.intensive_sessions)}</td><td><button type="button" onClick={() => showSessions(row.mentor_id, row.mentee_id)}>View sessions</button></td></tr>)}{!report.mentees.rows.length && <tr><td colSpan={8} className={styles.empty}>No mentees with dated sessions.</td></tr>}</tbody></table></div><WeeklyMentoringPagination page={pages.menteePage} pageSize={pages.pageSize} total={report.mentees.total_count} label="mentees" onPage={value => update({ mwMenteePage: String(value) }, false)}/></section>
      <section className={styles.section}><div className={styles.sectionHeading}><h3>Unscheduled / Needs Review <span>{count(report.review.total_count)}</span></h3></div><p className={styles.note}>Undated records matching the filters across all dates. Excluded from period totals.</p><WeeklyMentoringSessionTable rows={report.review.rows} params={params} empty="No undated sessions require review under these filters."/><WeeklyMentoringPagination page={pages.reviewPage} pageSize={pages.pageSize} total={report.review.total_count} label="undated sessions" onPage={value => update({ mwReviewPage: String(value) }, false)}/></section>
      <p className={styles.note}>Completion rate: completed ÷ all dated sessions except cancelled. Past scheduled sessions retain their actual status.</p>
    </> : null}
  </div>
}
