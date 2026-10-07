'use client'

import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  addDays, dayKey, eventContext, eventDisplayTitle, eventKey, eventRangeLabel, eventStyle, eventTime, eventTimeRange,
  isSpanning, overlaps, sourceName, weekSegments,
  type CalendarRole, type EventItem, type WeekSegment,
} from '@/lib/calendar/presentation'

const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
export const CALENDAR_PAGE_SIZE = 20

export function CalendarPagination({ page, total, onChange, label }: {
  page: number; total: number; onChange: (page: number) => void; label: string
}) {
  const pages = Math.max(1, Math.ceil(total / CALENDAR_PAGE_SIZE))
  if (pages <= 1) return null
  return <nav className="calendar-pagination" aria-label={label}>
    <button type="button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft aria-hidden="true" /></button>
    <span>{page} / {pages}</span>
    <button type="button" aria-label="Halaman berikutnya" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight aria-hidden="true" /></button>
  </nav>
}

export function CalendarEventButton({ event, onSelect, segment, style, variant = 'compact' }: {
  event: EventItem; onSelect: (event: EventItem) => void; segment?: WeekSegment;
  style?: CSSProperties; variant?: 'compact' | 'schedule'
}) {
  const description = `${sourceName(event)} · ${event.title}${event.focusName ? ` · ${event.focusName}` : ''} · ${eventRangeLabel(event)}${event.personName || event.menteeName ? ` · ${event.personName || event.menteeName}` : ''}`
  return <button type="button" className={`calendar-event ${event.source} calendar-event--${variant}${segment?.continuesBefore ? ' continues-before' : ''}${segment?.continuesAfter ? ' continues-after' : ''}`}
    style={{ ...eventStyle(event), ...style }} data-all-day={Boolean(event.allDay)} data-columns={segment ? segment.to - segment.from : 1} aria-label={description} title={description} onClick={() => onSelect(event)}>
    {segment?.continuesBefore ? <span className="calendar-continuation" aria-hidden="true">‹</span> : null}
    <small>{event.allDay ? 'Sepanjang hari' : segment?.continuesBefore ? 'Berlanjut' : variant === 'schedule' ? (isSpanning(event) ? 'Lintas hari' : eventTimeRange(event)) : eventTime(event)}</small>
    <span className="calendar-event__title">{eventDisplayTitle(event)}</span>
    {variant === 'compact' && event.source === 'strativate' && (event.personName || event.menteeName) ? <span className="calendar-event__participant">{event.personName || event.menteeName}</span> : null}
    {variant === 'schedule' ? <span className="calendar-event__context">{sourceName(event)}{event.personName || event.menteeName ? ` · ${event.personName || event.menteeName}` : ''}</span> : null}
    {segment?.continuesAfter ? <span className="calendar-continuation" aria-hidden="true">›</span> : null}
  </button>
}

export function CalendarMonth({ start, cursor, events, onSelect, onOpenDay }: {
  start: Date; cursor: Date; events: EventItem[];
  onSelect: (event: EventItem) => void; onOpenDay: (day: Date) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [slots, setSlots] = useState(3)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => setSlots(entry.contentRect.width < 600 ? 2 : 3))
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
  const today = dayKey(new Date())
  return <div className="calendar-month" ref={containerRef} role="region" aria-label="Kalender bulanan">
    <div className="calendar-weekday-header">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
    {Array.from({ length: 6 }, (_, week) => {
      const days = Array.from({ length: 7 }, (_, index) => addDays(start, week * 7 + index))
      const segments = weekSegments(events, days)
      return <div className="calendar-month-week" key={dayKey(days[0])} style={{ '--calendar-slots': slots } as CSSProperties}>
        <div className="calendar-month-days">{days.map((day, index) => {
          const hidden = segments.filter(segment => segment.lane >= slots && segment.from <= index && segment.to > index).length
          const outside = day.getMonth() !== cursor.getMonth()
          return <div className={`calendar-day${outside ? ' outside' : ''}${dayKey(day) === today ? ' is-today' : ''}`} key={dayKey(day)}>
            <time dateTime={dayKey(day)} aria-label={new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(day)} aria-current={dayKey(day) === today ? 'date' : undefined}>{day.getDate()}</time>
            {hidden > 0 ? <button type="button" className="calendar-overflow" aria-label={`${hidden} agenda lainnya pada ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(day)}`} onClick={() => onOpenDay(day)}>+{hidden}<span> lainnya</span></button> : null}
          </div>
        })}</div>
        <div className="calendar-month-events">{segments.filter(segment => segment.lane < slots).map(segment =>
          <CalendarEventButton key={eventKey(segment.event)} event={segment.event} segment={segment} onSelect={onSelect}
            style={{ gridColumn: `${segment.from + 1} / ${segment.to + 1}`, gridRow: segment.lane + 1 }} />
        )}</div>
      </div>
    })}
  </div>
}

export function CalendarWeek({ start, events, onSelect, loading = false }: {
  start: Date; events: EventItem[]; onSelect: (event: EventItem) => void; loading?: boolean
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const spans = weekSegments(events.filter(isSpanning), days)
  const today = dayKey(new Date())
  return <div className="calendar-week-scroll" tabIndex={0} role="region" aria-label="Jadwal mingguan; geser untuk melihat semua hari">
    <div className="calendar-week-schedule">
      <div className="calendar-week-head">{days.map((day, index) => <header key={dayKey(day)} className={dayKey(day) === today ? 'is-today' : ''}>
        <span>{weekdays[index]}</span><time dateTime={dayKey(day)} aria-current={dayKey(day) === today ? 'date' : undefined}>{day.getDate()}</time>
      </header>)}</div>
      {spans.length ? <section className="calendar-week-spans" aria-label="Agenda sepanjang hari dan lintas hari">
        <p>Sepanjang hari / lintas hari</p>
        <div className="calendar-span-scroll" tabIndex={0} role="region" aria-label="Daftar agenda lintas hari">
          <div className="calendar-span-grid">{spans.map(segment => <CalendarEventButton
            key={eventKey(segment.event)} event={segment.event} segment={segment} onSelect={onSelect}
            style={{ gridColumn: `${segment.from + 1} / ${segment.to + 1}`, gridRow: segment.lane + 1 }} />)}</div>
        </div>
      </section> : null}
      <div className="calendar-week-columns">{days.map(day => {
        const items = events.filter(event => !isSpanning(event) && overlaps(event, day, addDays(day, 1)))
        return <section key={dayKey(day)} aria-label={new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(day)}>
          <small className="calendar-day-count">{items.length ? `${items.length} agenda` : loading ? 'Memuat…' : 'Tidak ada agenda'}</small>
          <div className="calendar-day-schedule">{items.map(event => <CalendarEventButton key={eventKey(event)} event={event} onSelect={onSelect} variant="schedule" />)}</div>
        </section>
      })}</div>
    </div>
  </div>
}

export function CalendarAgenda({ events, role, query, page, onQueryChange, onPageChange, onSelect, emptyMessage }: {
  events: EventItem[]; role: CalendarRole; query: string; page: number;
  onQueryChange: (query: string) => void; onPageChange: (page: number) => void;
  onSelect: (event: EventItem) => void; emptyMessage: string
}) {
  const normalized = query.trim().toLocaleLowerCase('id-ID')
  const results = events.filter(event => [event.title, eventContext(event, role), sourceName(event), event.source]
    .join(' ').toLocaleLowerCase('id-ID').includes(normalized))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(results.length / CALENDAR_PAGE_SIZE)))
  const offset = (currentPage - 1) * CALENDAR_PAGE_SIZE
  const count = results.length ? `${offset + 1}–${Math.min(offset + CALENDAR_PAGE_SIZE, results.length)} dari ${results.length} agenda` : '0 agenda'
  return <div className="calendar-agenda">
    <div className="calendar-agenda-tools">
      <label className="calendar-search"><Search aria-hidden="true" /><input type="search" aria-label="Cari agenda" placeholder="Cari judul atau peserta" value={query} onChange={event => onQueryChange(event.target.value)} /></label>
      <span role="status">{count}</span>
    </div>
    <div className="calendar-agenda-list">{results.slice(offset, offset + CALENDAR_PAGE_SIZE).map(event => <button
      type="button" className={`calendar-agenda-row ${event.source}`} key={eventKey(event)} style={eventStyle(event)} onClick={() => onSelect(event)}>
      <time>{eventRangeLabel(event)}</time>
      <span className="calendar-agenda-content"><small className={`calendar-source-label source-${event.source}`}>{sourceName(event)}</small><strong title={event.title}>{eventDisplayTitle(event)}</strong>{eventContext(event, role) ? <span title={eventContext(event, role)}>{eventContext(event, role)}</span> : null}</span>
      <ChevronRight aria-hidden="true" />
    </button>)}</div>
    {!results.length ? <p className="calendar-empty">{normalized && events.length ? 'Tidak ada agenda yang cocok dengan pencarian.' : emptyMessage}</p> : null}
    <CalendarPagination page={currentPage} total={results.length} onChange={onPageChange} label="Halaman agenda" />
  </div>
}
