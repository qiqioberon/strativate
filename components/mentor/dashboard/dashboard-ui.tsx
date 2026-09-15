'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  mentorSessionStatusLabel,
  mentorSessionStatusTone,
  type MentorSessionRow,
  type MentorSessionStatus,
} from '@/lib/mentor/dashboard'
import type { SortDirection } from '@/components/admin/sortable-table-header'

const collator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' })

export function timestamp(value: string | null, fallback = Number.MAX_SAFE_INTEGER) {
  if (!value) return fallback
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : fallback
}

export function sessionDate(session: MentorSessionRow, timezone: string, withDate = true) {
  if (!session.scheduled_start_at) return 'Belum dijadwalkan'
  return new Intl.DateTimeFormat('id-ID', {
    ...(withDate ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    timeZone: session.mentor_timezone || timezone,
  }).format(new Date(session.scheduled_start_at))
}

export function detailDate(session: MentorSessionRow, timezone: string) {
  if (!session.scheduled_start_at) return 'Belum dijadwalkan'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: session.mentor_timezone || timezone,
  }).format(new Date(session.scheduled_start_at))
}

export function sessionDay(session: MentorSessionRow, timezone: string) {
  if (!session.scheduled_start_at) return 'Belum dijadwalkan'
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: session.mentor_timezone || timezone,
  }).format(new Date(session.scheduled_start_at))
}

export function statusClass(status: MentorSessionStatus) {
  return `ops-status ops-status--${mentorSessionStatusTone(status)}`
}

export function availabilityLabel(value: boolean | null) {
  if (value === null) return 'Belum terverifikasi'
  return value ? 'Sudah diatur' : 'Belum diatur'
}

export function availabilityTone(value: boolean | null) {
  if (value === null) return 'neutral'
  return value ? 'positive' : 'warning'
}

export function sortText(left: string | null | undefined, right: string | null | undefined, direction: SortDirection) {
  if (!direction) return 0
  const result = collator.compare(left || '', right || '')
  return direction === 'asc' ? result : -result
}

export function sortNumber(left: number, right: number, direction: SortDirection) {
  if (!direction) return 0
  return direction === 'asc' ? left - right : right - left
}

export function MentorPageHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="mentor-page-header"><div className="mentor-page-header__copy"><p className="kicker">{eyebrow}</p><h1>{title}</h1><p>{detail}</p></div>{action ? <div className="mentor-page-header__action">{action}</div> : null}</div>
}

export function DataError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <section className="role-card mentor-data-state mentor-data-state--error" role="alert"><strong>Data operasional belum dapat dimuat.</strong><p>{message}</p><button type="button" className="button button-outline" onClick={onRetry}>Muat ulang</button></section>
}

export function EmptyState({ icon: Icon, title, detail, action }: { icon: LucideIcon; title: string; detail: string; action?: ReactNode }) {
  return <section className="role-card mentor-data-state"><Icon aria-hidden="true"/><strong>{title}</strong><p>{detail}</p>{action}</section>
}

export function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <section className="metric-card mentor-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></section>
}

export { mentorSessionStatusLabel }
