'use client'

import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { count, percent } from '@/lib/admin/sales-reporting'
import { mentoringAnalyticsHref, type MentoringReportKind, type MentoringReportSummary } from '@/lib/admin/mentoring-reporting'
import { useWeeklyMentoringReport } from './weekly-mentoring-report-hook'
import styles from './weekly-mentoring.module.css'

export function WeeklyMentoringKpis({ summary }: { summary: MentoringReportSummary }) {
  const metrics: Array<[string, string, string?]> = [
    ['Dated sessions', count(summary.total), 'One current session record, attributed by scheduled start in WIB.'],
    ['Completed', count(summary.completed), 'Canonical completed status.'],
    ['Unfinished', count(summary.unfinished), `${count(summary.scheduled)} scheduled; includes dated sessions awaiting topic or scheduling.`],
    ['Cancelled', count(summary.cancelled)],
    ['Completion rate', percent(summary.completion_rate), 'Completed divided by all dated sessions except cancelled sessions.'],
    ['Mentors with sessions', count(summary.mentors), 'Distinct assigned mentors, including inactive mentors with sessions.'],
    ['Mentees with sessions', count(summary.mentees), 'Each mentee is counted once.'],
  ]
  return <dl className={styles.kpis}>{metrics.map(([label, value, title]) => <div key={label} title={title}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
export function WeeklyMentoringSummary({ from, to, kind = 'all' }: { from: string | null; to: string; kind?: MentoringReportKind }) {
  const { report, loading, error, refresh } = useWeeklyMentoringReport(
    { from, to, kind, mentor: 'all', status: 'all', query: '', mentee: null },
    { sessionPage: 1, mentorPage: 1, menteePage: 1, reviewPage: 1, pageSize: 5 },
  )
  return <section className={styles.summary} aria-label="Mentoring operations in the reporting period">
    <div className={styles.sectionHeading}><h3>Mentoring operations</h3><Link href={mentoringAnalyticsHref(from, to, kind)} className={styles.detailLink}>Session analytics <ArrowRight size={14}/></Link></div>
    <p className={styles.note}>Sessions use their scheduled start in WIB. Paid-order revenue and purchased session entitlements use separate measures.</p>
    {error ? <div className={styles.error} role="alert">{error}<button type="button" onClick={refresh}><RefreshCw size={14}/>Retry</button></div> : loading && !report ? <p role="status" className={styles.empty}>Loading mentoring operations…</p> : report ? <>
      <WeeklyMentoringKpis summary={report.summary}/>
      <div className={styles.distribution}><span>Private: <strong>{count(report.summary.private_sessions)}</strong></span><span>Intensive: <strong>{count(report.summary.intensive_sessions)}</strong></span><span>Undated, needs review: <strong>{count(report.review.total_count)}</strong></span></div>
      <div className={styles.sectionHeading}><h4>Top mentors by completed sessions</h4></div>
      {report.top_mentors.length ? <ol className={styles.leaderboard}>{report.top_mentors.map(row => <li key={row.mentor_id}><span>{row.mentor_name}</span><strong>{count(row.completed)} completed</strong></li>)}</ol> : <p className={styles.empty}>No completed sessions in this period.</p>}
    </> : null}
  </section>
}
