export type TimeIntervalLike = { start:string; end:string }
export type GoogleCalendarAvailabilityStatus = 'verified' | 'not_connected' | 'unavailable'
export type SchedulingWeekFilter = 'all' | 'current' | 'next'

export function resolveGoogleCalendarBusy({ connected, busy }: { connected:boolean; busy:TimeIntervalLike[]|null }) {
  if (!connected) return { googleBusy:[] as TimeIntervalLike[], status:'not_connected' as const }
  if (busy === null) return { googleBusy:[] as TimeIntervalLike[], status:'unavailable' as const }
  return { googleBusy:busy, status:'verified' as const }
}

function dateKeyInTimeZone(value: Date | string, timezone: string) {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:timezone,
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

function addIsoDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0,10)
}

function weekStart(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  const isoDay = date.getUTCDay() || 7
  return addIsoDays(value, -(isoDay - 1))
}

function isoWeekday(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getUTCDay() || 7
}

export function availabilityWeekKind(value: string, timezone: string, now: Date): 'current' | 'next' | 'other' {
  const localDate = dateKeyInTimeZone(value, timezone)
  const currentWeekStart = weekStart(dateKeyInTimeZone(now, timezone))
  const nextWeekStart = addIsoDays(currentWeekStart, 7)
  if (localDate >= currentWeekStart && localDate <= addIsoDays(currentWeekStart, 6)) return 'current'
  if (localDate >= nextWeekStart && localDate <= addIsoDays(nextWeekStart, 6)) return 'next'
  return 'other'
}

export function availabilityMatchesFilters(
  range: TimeIntervalLike,
  timezone: string,
  now: Date,
  weekFilter: SchedulingWeekFilter,
  dayFilter: number | null,
) {
  const end = new Date(range.end).getTime()
  if (!Number.isFinite(end) || end <= now.getTime()) return false

  const localDate = dateKeyInTimeZone(range.start, timezone)
  const currentWeekStart = weekStart(dateKeyInTimeZone(now, timezone))
  const nextWeekStart = addIsoDays(currentWeekStart, 7)
  const currentWeekEnd = addIsoDays(currentWeekStart, 6)
  const nextWeekEnd = addIsoDays(nextWeekStart, 6)

  if (weekFilter === 'current' && (localDate < currentWeekStart || localDate > currentWeekEnd)) return false
  if (weekFilter === 'next' && (localDate < nextWeekStart || localDate > nextWeekEnd)) return false
  if (dayFilter !== null && isoWeekday(localDate) !== dayFilter) return false
  return true
}
