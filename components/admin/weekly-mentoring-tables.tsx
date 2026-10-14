'use client'

import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { count } from '@/lib/admin/sales-reporting'
import { mentoringDetailHref, mentoringKindLabel, mentoringStatusLabel, mentoringTime, type MentoringReportSession } from '@/lib/admin/mentoring-reporting'
import styles from './weekly-mentoring.module.css'

export function WeeklyMentoringPagination({ page, pageSize, total, label, onPage }: { page: number; pageSize: number; total: number; label: string; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <nav className={styles.pagination} aria-label={`${label} pagination`}>
    <span>{count(total)} records · Page {count(page)} of {count(pages)}</span>
    <div><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={`Previous ${label} page`}><ChevronLeft size={15}/></button>
    <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={`Next ${label} page`}><ChevronRight size={15}/></button></div>
  </nav>
}
export function WeeklyMentoringSessionTable({ rows, params, empty }: { rows: MentoringReportSession[]; params: URLSearchParams; empty: string }) {
  return <div className={styles.tableScroll} tabIndex={0} aria-label="Mentoring session details">
    <table className={styles.table}><thead><tr><th>Mentee</th><th>Mentor / program</th><th>Session</th><th>Date & time (WIB)</th><th>Status</th><th>Topic</th><th>Details</th></tr></thead>
      <tbody>{rows.map(row => <tr key={`${row.kind}:${row.session_id}`}>
        <td><strong>{row.mentee_name}</strong>{row.mentee_email && <small>{row.mentee_email}</small>}</td>
        <td><strong>{row.mentor_name}</strong><small>{row.program || 'Program unavailable'}</small></td>
        <td>{mentoringKindLabel(row.kind)}<small>Session {row.session_number}{row.duration_minutes != null ? ` · ${row.duration_minutes} min` : ''}</small></td>
        <td>{mentoringTime(row.start_at)}</td>
        <td><span className={styles.status} data-status={row.status}>{mentoringStatusLabel(row.status)}</span>{row.needs_review && <small className={styles.reviewText}>{row.review_reason}</small>}</td>
        <td>{row.topic || '—'}</td>
        <td><Link className={styles.detailLink} href={mentoringDetailHref(params, row)} scroll={false} aria-label={`Open ${row.mentee_name}, session ${row.session_number}`}>Open <ArrowRight size={14}/></Link></td>
      </tr>)}{!rows.length && <tr><td colSpan={7} className={styles.empty}>{empty}</td></tr>}</tbody>
    </table>
  </div>
}
