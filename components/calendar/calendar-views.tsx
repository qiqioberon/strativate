'use client'

import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  addDays, dayKey, eventContext, eventDisplayTitle, eventParticipantName, eventKey, eventRangeLabel, eventStyle, eventTime, eventTimeRange,
  isSpanning, overlaps, sourceName, weekSegments,
  type CalendarLocale, type CalendarRole, type EventItem, type WeekSegment,
} from '@/lib/calendar/presentation'

const weekdays = { 'id-ID': ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'], 'en-GB': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
export const CALENDAR_PAGE_SIZE = 20

export function CalendarPagination({ page, total, onChange, label, locale = 'id-ID' }: {
  page: number; total: number; onChange: (page: number) => void; label: string; locale?: CalendarLocale
}) {
  const pages = Math.max(1, Math.ceil(total / CALENDAR_PAGE_SIZE))
  if (pages <= 1) return null
  return <nav className="calendar-pagination" aria-label={label}>
    <button type="button" aria-label={locale === 'en-GB' ? 'Previous page' : 'Halaman sebelumnya'} disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft aria-hidden="true" /></button>
    <span>{page} / {pages}</span>
    <button type="button" aria-label={locale === 'en-GB' ? 'Next page' : 'Halaman berikutnya'} disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight aria-hidden="true" /></button>
  </nav>
}

export function CalendarEventButton({ event, onSelect, segment, style, variant = 'compact', locale = 'id-ID' }: {
  event: EventItem; onSelect: (event: EventItem) => void; segment?: WeekSegment;
  style?: CSSProperties; variant?: 'compact' | 'schedule'; locale?: CalendarLocale
}) {
  const english = locale === 'en-GB'
  const description = `${sourceName(event, locale)} · ${eventDisplayTitle(event, locale)}${event.focusName ? ` · ${event.focusName}` : ''} · ${eventRangeLabel(event, false, locale)}${eventParticipantName(event, locale) ? ` · ${eventParticipantName(event, locale)}` : ''}`
  return <button type="button" className={`calendar-event ${event.source} calendar-event--${variant}${segment?.continuesBefore ? ' continues-before' : ''}${segment?.continuesAfter ? ' continues-after' : ''}`}
    style={{ ...eventStyle(event, locale), ...style }} data-all-day={Boolean(event.allDay)} data-columns={segment ? segment.to - segment.from : 1} aria-label={description} title={description} onClick={() => onSelect(event)}>
    {segment?.continuesBefore ? <span className="calendar-continuation" aria-hidden="true">‹</span> : null}
    <small>{event.allDay ? english ? 'All day' : 'Sepanjang hari' : segment?.continuesBefore ? english ? 'Continues' : 'Berlanjut' : variant === 'schedule' ? (isSpanning(event) ? english ? 'Multiple days' : 'Lintas hari' : eventTimeRange(event, locale)) : eventTime(event, locale)}</small>
    <span className="calendar-event__title">{eventDisplayTitle(event, locale)}</span>
    {variant === 'compact' && event.source === 'strativate' && (eventParticipantName(event, locale)) ? <span className="calendar-event__participant">{eventParticipantName(event, locale)}</span> : null}
    {variant === 'schedule' ? <span className="calendar-event__context">{sourceName(event, locale)}{eventParticipantName(event, locale) ? ` · ${eventParticipantName(event, locale)}` : ''}</span> : null}
    {segment?.continuesAfter ? <span className="calendar-continuation" aria-hidden="true">›</span> : null}
  </button>
}

export function CalendarMonth({ start, cursor, events, onSelect, onOpenDay, locale = 'id-ID' }: {
  start: Date; cursor: Date; events: EventItem[];
  onSelect: (event: EventItem) => void; onOpenDay: (day: Date) => void; locale?: CalendarLocale
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
  return <div className="calendar-month" ref={containerRef} role="region" aria-label={locale === 'en-GB' ? 'Monthly calendar' : 'Kalender bulanan'}>
    <div className="calendar-weekday-header">{weekdays[locale].map(day => <span key={day}>{day}</span>)}</div>
    {Array.from({ length: 6 }, (_, week) => {
      const days = Array.from({ length: 7 }, (_, index) => addDays(start, week * 7 + index))
      const segments = weekSegments(events, days)
      return <div className="calendar-month-week" key={dayKey(days[0])} style={{ '--calendar-slots': slots } as CSSProperties}>
        <div className="calendar-month-days">{days.map((day, index) => {
          const hidden = segments.filter(segment => segment.lane >= slots && segment.from <= index && segment.to > index).length
          const outside = day.getMonth() !== cursor.getMonth()
          return <div className={`calendar-day${outside ? ' outside' : ''}${dayKey(day) === today ? ' is-today' : ''}`} key={dayKey(day)}>
            <time dateTime={dayKey(day)} aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(day)} aria-current={dayKey(day) === today ? 'date' : undefined}>{day.getDate()}</time>
            {hidden > 0 ? <button type="button" className="calendar-overflow" aria-label={`${hidden} ${locale === 'en-GB' ? 'more events on' : 'agenda lainnya pada'} ${new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(day)}`} onClick={() => onOpenDay(day)}>+{hidden}<span>{locale === 'en-GB' ? ' more' : ' lainnya'}</span></button> : null}
          </div>
        })}</div>
        <div className="calendar-month-events">{segments.filter(segment => segment.lane < slots).map(segment =>
          <CalendarEventButton key={eventKey(segment.event)} event={segment.event} segment={segment} onSelect={onSelect} locale={locale}
            style={{ gridColumn: `${segment.from + 1} / ${segment.to + 1}`, gridRow: segment.lane + 1 }} />
        )}</div>
      </div>
    })}
  </div>
}

export function CalendarWeek({ start, events, onSelect, loading = false, locale = 'id-ID' }: {
  start: Date; events: EventItem[]; onSelect: (event: EventItem) => void; loading?: boolean; locale?: CalendarLocale
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const spans = weekSegments(events.filter(isSpanning), days)
  const today = dayKey(new Date())
  const english = locale === 'en-GB'
  return <div className="calendar-week-scroll" tabIndex={0} role="region" aria-label={english ? 'Weekly schedule; scroll to see all days' : 'Jadwal mingguan; geser untuk melihat semua hari'}>
    <div className="calendar-week-schedule">
      <div className="calendar-week-head">{days.map((day, index) => <header key={dayKey(day)} className={dayKey(day) === today ? 'is-today' : ''}>
        <span>{weekdays[locale][index]}</span><time dateTime={dayKey(day)} aria-current={dayKey(day) === today ? 'date' : undefined}>{day.getDate()}</time>
      </header>)}</div>
      {spans.length ? <section className="calendar-week-spans" aria-label={english ? 'All-day and multi-day events' : 'Agenda sepanjang hari dan lintas hari'}>
        <p>{english ? 'All day / multiple days' : 'Sepanjang hari / lintas hari'}</p>
        <div className="calendar-span-scroll" tabIndex={0} role="region" aria-label={english ? 'Multi-day events' : 'Daftar agenda lintas hari'}>
          <div className="calendar-span-grid">{spans.map(segment => <CalendarEventButton
            key={eventKey(segment.event)} event={segment.event} segment={segment} onSelect={onSelect} locale={locale}
            style={{ gridColumn: `${segment.from + 1} / ${segment.to + 1}`, gridRow: segment.lane + 1 }} />)}</div>
        </div>
      </section> : null}
      <div className="calendar-week-columns">{days.map(day => {
        const items = events.filter(event => !isSpanning(event) && overlaps(event, day, addDays(day, 1)))
        return <section key={dayKey(day)} aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(day)}>
          <small className="calendar-day-count">{items.length ? `${items.length} ${english ? 'events' : 'agenda'}` : loading ? english ? 'Loading…' : 'Memuat…' : english ? 'No events' : 'Tidak ada agenda'}</small>
          <div className="calendar-day-schedule">{items.map(event => <CalendarEventButton key={eventKey(event)} event={event} onSelect={onSelect} variant="schedule" locale={locale} />)}</div>
        </section>
      })}</div>
    </div>
  </div>
}

export function CalendarAgenda({ events, role, query, page, onQueryChange, onPageChange, onSelect, emptyMessage, locale = 'id-ID' }: {
  events: EventItem[]; role: CalendarRole; query: string; page: number;
  onQueryChange: (query: string) => void; onPageChange: (page: number) => void;
  onSelect: (event: EventItem) => void; emptyMessage: string; locale?: CalendarLocale
}) {
  const english = locale === 'en-GB'
  const normalized = query.trim().toLocaleLowerCase(locale)
  const results = events.filter(event => [event.title, eventDisplayTitle(event, locale), eventContext(event, role, locale), sourceName(event, locale), event.source]
    .join(' ').toLocaleLowerCase(locale).includes(normalized))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(results.length / CALENDAR_PAGE_SIZE)))
  const offset = (currentPage - 1) * CALENDAR_PAGE_SIZE
  const count = results.length ? `${offset + 1}–${Math.min(offset + CALENDAR_PAGE_SIZE, results.length)} ${english ? 'of' : 'dari'} ${results.length} ${english ? 'events' : 'agenda'}` : english ? '0 events' : '0 agenda'
  return <div className="calendar-agenda">
    <div className="calendar-agenda-tools">
      <label className="calendar-search"><Search aria-hidden="true" /><input type="search" aria-label={english ? 'Search events' : 'Cari agenda'} placeholder={english ? 'Search by title or participant' : 'Cari judul atau peserta'} value={query} onChange={event => onQueryChange(event.target.value)} /></label>
      <span role="status">{count}</span>
    </div>
    <div className="calendar-agenda-list">{results.slice(offset, offset + CALENDAR_PAGE_SIZE).map(event => <button
      type="button" className={`calendar-agenda-row ${event.source}`} key={eventKey(event)} style={eventStyle(event, locale)} onClick={() => onSelect(event)}>
      <time>{eventRangeLabel(event, false, locale)}</time>
      <span className="calendar-agenda-content"><small className={`calendar-source-label source-${event.source}`}>{sourceName(event, locale)}</small><strong title={eventDisplayTitle(event, locale)}>{eventDisplayTitle(event, locale)}</strong>{eventContext(event, role, locale) ? <span title={eventContext(event, role, locale)}>{eventContext(event, role, locale)}</span> : null}</span>
      <ChevronRight aria-hidden="true" />
    </button>)}</div>
    {!results.length ? <p className="calendar-empty">{normalized && events.length ? english ? 'No events match your search.' : 'Tidak ada agenda yang cocok dengan pencarian.' : emptyMessage}</p> : null}
    <CalendarPagination page={currentPage} total={results.length} onChange={onPageChange} label={english ? 'Agenda pages' : 'Halaman agenda'} locale={locale} />
  </div>
}
