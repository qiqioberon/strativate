import type { CSSProperties } from 'react'

export type CalendarRole = 'admin' | 'mentor' | 'mentee'
export type CalendarLocale = 'id-ID' | 'en-GB'
export type CalendarView = 'month' | 'week' | 'agenda'
export type EventItem = {
  id: string
  source: 'strativate' | 'google'
  title: string
  start: string
  end: string
  allDay?: boolean
  htmlLink?: string | null
  sessionId?: string
  mentoringType?: 'private' | 'intensive'
  sessionNumber?: number
  purchasedSessions?: number
  focusName?: string | null
  status?: string
  mentorName?: string | null
  mentorTierName?: string | null
  menteeName?: string | null
  menteeEmail?: string | null
  timezone?: string | null
  durationMinutes?: number | null
  meetingUrl?: string | null
  managedMeetingUrl?: string | null
  zoomRoomName?: string | null
  manualMeetingUrl?: string | null
  googleSyncStatus?: string | null
  googleSyncError?: string | null
  personId?: string | null
  personName?: string | null
  personColor?: string | null
}

export function addDays(value: Date, count: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + count)
  return date
}

export function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function monday(value: Date) {
  const date = startOfDay(value)
  return addDays(date, -((date.getDay() + 6) % 7))
}

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Date-only values are civil dates, never UTC instants. The end stays exclusive.
export function eventDate(event: EventItem, edge: 'start' | 'end') {
  const value = event[edge]
  if (event.allDay) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(value)
}

export function overlaps(event: EventItem, start: Date, end: Date) {
  return eventDate(event, 'end') > start && eventDate(event, 'start') < end
}

export function visibleRange(cursor: Date, view: CalendarView) {
  const start = view === 'month'
    ? monday(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
    : monday(cursor)
  return { start, end: addDays(start, view === 'month' ? 42 : 7) }
}

export function compareEvents(a: EventItem, b: EventItem) {
  return eventDate(a, 'start').getTime() - eventDate(b, 'start').getTime()
    || Number(Boolean(b.allDay)) - Number(Boolean(a.allDay))
    || a.title.localeCompare(b.title, 'id-ID') || eventKey(a).localeCompare(eventKey(b))
}

export function eventKey(event: EventItem) { return `${event.source}-${event.id}` }
export function sourceName(event: EventItem, locale: CalendarLocale = 'id-ID') {
  return event.source === 'google' ? 'Google Calendar' : locale === 'en-GB' ? 'Strativate sessions' : 'Sesi Strativate'
}
export function eventDisplayTitle(event: EventItem, locale: CalendarLocale = 'id-ID') {
  if (event.source === 'google') return event.title
  const topic = event.focusName || (event.mentoringType === 'intensive' ? 'Intensive Mentoring' : 'Private Mentoring')
  if (event.sessionNumber) return `${topic} · ${locale === 'en-GB' ? 'Session' : 'Sesi'} ${event.sessionNumber}`
  return locale === 'en-GB' && /^(Private|Intensive) Mentoring\s*·\s*Sesi\s+\d+$/i.test(event.title)
    ? event.title.replace(/\bSesi\b/i, 'Session') : event.title
}
export function personKey(event: EventItem) {
  return event.personId || event.menteeEmail || event.personName || event.menteeName || event.sessionId || event.id
}

export function personColor(event: EventItem, locale: CalendarLocale = 'id-ID') {
  if (event.personColor && locale === 'id-ID') return event.personColor
  const palette = locale === 'en-GB' ? ['#b66b31', '#985746', '#8b722a', '#75564a'] : ['#a65e2e', '#537892', '#74658b', '#4b7d69', '#967237', '#956477']
  const identity = personKey(event)
  let hash = 0
  for (const char of identity) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return palette[hash % palette.length]
}

export function eventStyle(event: EventItem, locale: CalendarLocale = 'id-ID'): CSSProperties {
  return { '--person-color': event.source === 'google' ? '#4285f4' : personColor(event, locale) } as CSSProperties
}

export function isSpanning(event: EventItem) {
  return Boolean(event.allDay) || eventDate(event, 'end') > addDays(startOfDay(eventDate(event, 'start')), 1)
}

export function eventTime(event: EventItem, locale: CalendarLocale = 'id-ID') {
  if (event.allDay) return locale === 'en-GB' ? 'All day' : 'Sepanjang hari'
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(eventDate(event, 'start'))
}

export function eventTimeRange(event: EventItem, locale: CalendarLocale = 'id-ID') {
  if (event.allDay) return locale === 'en-GB' ? 'All day' : 'Sepanjang hari'
  const format = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
  return `${format.format(eventDate(event, 'start'))}–${format.format(eventDate(event, 'end'))}`
}

export function eventRangeLabel(event: EventItem, detail = false, locale: CalendarLocale = 'id-ID') {
  const start = eventDate(event, 'start')
  const end = event.allDay ? addDays(eventDate(event, 'end'), -1) : eventDate(event, 'end')
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric', month: detail ? 'long' : 'short', year: 'numeric',
    ...(!event.allDay && detail && event.timezone ? { timeZone: event.timezone } : {}),
  }
  const dateFormat = new Intl.DateTimeFormat(locale, options)
  const first = dateFormat.format(start)
  const last = dateFormat.format(end)
  if (event.allDay) return `${first === last ? first : `${first} – ${last}`} · ${locale === 'en-GB' ? 'All day' : 'Sepanjang hari'}`
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit',
    ...(detail && event.timezone ? { timeZone: event.timezone } : {}),
  })
  return `${first}, ${timeFormat.format(start)} – ${first === last ? '' : `${last}, `}${timeFormat.format(end)}`
}

export function eventParticipantName(event: EventItem, locale: CalendarLocale = 'id-ID') {
  const name = event.personName || event.menteeName || ''
  return locale === 'en-GB' && event.source === 'strativate' && event.personName === 'Saya' ? 'You' : name
}

export function eventContext(event: EventItem, role: CalendarRole, locale: CalendarLocale = 'id-ID') {
  return [eventParticipantName(event, locale), event.mentorName, event.focusName,
    role === 'admin' ? event.menteeEmail : null].filter(Boolean).join(' · ')
}

export function readableStatus(value?: string | null, locale: CalendarLocale = 'id-ID') {
  const labels: Record<string, string> = locale === 'en-GB' ? {
    scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', canceled: 'Cancelled',
    pending: 'Pending', synced: 'Synced', failed: 'Sync failed',
    not_scheduled: 'Not scheduled', requested: 'Requested', approved: 'Approved',
    draft: 'Draft', rejected: 'Rejected', in_progress: 'In progress',
    terjadwal: 'Scheduled', selesai: 'Completed', dibatalkan: 'Cancelled',
    menunggu: 'Pending', tersinkron: 'Synced', gagal_disinkronkan: 'Sync failed',
    belum_dijadwalkan: 'Not scheduled', diajukan: 'Requested', disetujui: 'Approved',
    belum_tersedia: 'Not available', gagal: 'Failed', ditolak: 'Rejected',
  } : {
    scheduled: 'Terjadwal', completed: 'Selesai', cancelled: 'Dibatalkan',
    pending: 'Menunggu', synced: 'Tersinkron', failed: 'Gagal disinkronkan',
    not_scheduled: 'Belum dijadwalkan', requested: 'Diajukan', approved: 'Disetujui',
  }
  if (!value) return locale === 'en-GB' ? 'Not available' : 'Belum tersedia'
  const key = locale === 'en-GB' ? value.trim().toLocaleLowerCase(locale).replaceAll(' ', '_') : value
  return labels[key] || value.replaceAll('_', ' ')
}

export type WeekSegment = {
  event: EventItem; from: number; to: number; lane: number; continuesBefore: boolean; continuesAfter: boolean
}

// Allocate one row across every occupied column, including clipped week segments.
export function weekSegments(events: EventItem[], days: Date[]): WeekSegment[] {
  const start = days[0]
  const end = addDays(start, 7)
  const occupied: boolean[][] = []
  return events.filter(event => overlaps(event, start, end))
    .sort((a, b) => Number(isSpanning(b)) - Number(isSpanning(a)) || compareEvents(a, b))
    .map(event => {
      const columns = days.map((day, index) => overlaps(event, day, addDays(day, 1)) ? index : -1).filter(index => index >= 0)
      const from = columns[0]
      const to = columns[columns.length - 1] + 1
      let lane = occupied.findIndex(row => !row.slice(from, to).some(Boolean))
      if (lane < 0) { lane = occupied.length; occupied.push(Array(7).fill(false)) }
      for (let column = from; column < to; column++) occupied[lane][column] = true
      return { event, from, to, lane, continuesBefore: eventDate(event, 'start') < start, continuesAfter: eventDate(event, 'end') > end }
    })
}
