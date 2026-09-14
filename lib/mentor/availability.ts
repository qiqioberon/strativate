import type { MentorAvailabilityRule } from '@/lib/supabase/database.types'

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type AvailabilityDraftRange = {
  key: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export type AvailabilityPayloadRange = {
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
}

export type AvailabilityWeekOption = {
  kind: 'current' | 'next'
  weekStartDate: string
  weekEndDate: string
}

export const DAYS_OF_WEEK: ReadonlyArray<{ value: DayOfWeek; label: string }> = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
  { value: 7, label: 'Minggu' },
]

const clockPattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

function parseIsoDate(value: string) {
  const match = isoDatePattern.exec(value)
  if (!match) throw new Error('Invalid ISO date')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (date.toISOString().slice(0, 10) !== value) throw new Error('Invalid ISO date')
  return date
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addIsoDays(value: string, amount: number) {
  const date = parseIsoDate(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return formatIsoDate(date)
}

export function dateInTimeZone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

export function availabilityWeekOptions(todayIso: string): AvailabilityWeekOption[] {
  const date = parseIsoDate(todayIso)
  const isoWeekday = date.getUTCDay() || 7
  const currentWeekStart = addIsoDays(todayIso, -(isoWeekday - 1))
  const nextWeekStart = addIsoDays(currentWeekStart, 7)
  return [
    {
      kind: 'current',
      weekStartDate: currentWeekStart,
      weekEndDate: addIsoDays(currentWeekStart, 6),
    },
    {
      kind: 'next',
      weekStartDate: nextWeekStart,
      weekEndDate: addIsoDays(nextWeekStart, 6),
    },
  ]
}

function sortedRanges(ranges: AvailabilityDraftRange[]) {
  return [...ranges].sort((left, right) =>
    left.dayOfWeek - right.dayOfWeek
      || left.startTime.localeCompare(right.startTime)
      || left.endTime.localeCompare(right.endTime),
  )
}

export function validateAvailabilityDraft(ranges: AvailabilityDraftRange[]): string | null {
  for (const current of ranges) {
    if (!Number.isInteger(current.dayOfWeek) || current.dayOfWeek < 1 || current.dayOfWeek > 7) {
      return 'Pilih hari antara Senin dan Minggu.'
    }
    if (!clockPattern.test(current.startTime) || !clockPattern.test(current.endTime)) {
      return 'Gunakan format waktu 24 jam HH:mm.'
    }
    if (current.startTime >= current.endTime) {
      return 'Waktu selesai harus setelah waktu mulai.'
    }
  }

  const sorted = sortedRanges(ranges)
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (previous.dayOfWeek === current.dayOfWeek && current.startTime < previous.endTime) {
      const day = DAYS_OF_WEEK.find(({ value }) => value === current.dayOfWeek)
      return `Rentang waktu hari ${day?.label || ''} saling tumpang tindih.`
    }
  }
  return null
}

export function toAvailabilityPayload(ranges: AvailabilityDraftRange[]): AvailabilityPayloadRange[] {
  return sortedRanges(ranges).map(({ dayOfWeek, startTime, endTime }) => ({
    day_of_week: dayOfWeek as DayOfWeek,
    start_time: startTime,
    end_time: endTime,
  }))
}

export function groupAvailabilityByDay(ranges: AvailabilityDraftRange[]) {
  const grouped = Object.fromEntries(
    DAYS_OF_WEEK.map(({ value }) => [value, [] as AvailabilityDraftRange[]]),
  ) as Record<DayOfWeek, AvailabilityDraftRange[]>
  for (const current of sortedRanges(ranges)) {
    if (current.dayOfWeek >= 1 && current.dayOfWeek <= 7) {
      grouped[current.dayOfWeek as DayOfWeek].push(current)
    }
  }
  return grouped
}

export function availabilityRulesToDraft(rules: MentorAvailabilityRule[]): AvailabilityDraftRange[] {
  return rules.map(rule => ({
    key: rule.id,
    dayOfWeek: rule.day_of_week,
    startTime: rule.start_time.slice(0, 5),
    endTime: rule.end_time.slice(0, 5),
  }))
}
