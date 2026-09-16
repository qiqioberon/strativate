import {
  buildBookableMentorDays,
  slotMatchesTimeRange,
  type SchedulingMentorLike,
  type SchedulingSlotLike,
  type TimeIntervalLike,
} from '@/lib/private-mentoring/scheduling-availability'

export type MenteeAvailabilityTier = {
  id: string
  code: string
  name: string
}

export type MenteeAvailabilitySlot = {
  start: string
  end: string
}

export type MenteeAvailabilityDay = {
  dateKey: string
  ranges: TimeIntervalLike[]
  slots: MenteeAvailabilitySlot[]
}

export type MenteeAvailabilityMentor = {
  mentorId: string
  mentorName: string
  tierId: string
  tierName: string
  timezone: string
  weekStartDate: string
  days: MenteeAvailabilityDay[]
}

export type MenteeAvailabilityPayload = {
  generatedAt: string
  durationMinutes: number
  windowStart: string
  windowEnd: string
  tiers: MenteeAvailabilityTier[]
  mentors: MenteeAvailabilityMentor[]
}

export type MenteeAvailabilityFilters = {
  mentorQuery: string
  tierId: string
  date: string
  timeStart: string
  timeEnd: string
}

export type MenteeDiscoveryMentorInput = SchedulingMentorLike & {
  tierId: string
  tierName: string
  weekStartDate: string
}

function addIsoDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime())) return value
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function mergeBookableSlotRanges(slots: SchedulingSlotLike[]) {
  const sorted = [...slots].sort((left, right) =>
    new Date(left.start).getTime() - new Date(right.start).getTime()
      || new Date(left.end).getTime() - new Date(right.end).getTime(),
  )
  const ranges: TimeIntervalLike[] = []

  for (const slot of sorted) {
    const start = new Date(slot.start).getTime()
    const end = new Date(slot.end).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue

    const previous = ranges.at(-1)
    if (previous && start <= new Date(previous.end).getTime()) {
      if (end > new Date(previous.end).getTime()) previous.end = slot.end
      continue
    }
    ranges.push({ start: slot.start, end: slot.end })
  }

  return ranges
}

export function buildTwoWeekDateKeys(weekStartDate: string) {
  return Array.from({ length: 14 }, (_, index) => addIsoDays(weekStartDate, index))
}

export function buildMenteeAvailabilityMentors<TSlot extends SchedulingSlotLike>({
  mentors,
  slots,
}: {
  mentors: MenteeDiscoveryMentorInput[]
  slots: TSlot[]
}) {
  const bookableDays = buildBookableMentorDays({
    mentors,
    slots,
    filters: { mentorQuery: '', date: '', timeStart: '', timeEnd: '' },
  })
  const daysByMentor = new Map<string, MenteeAvailabilityDay[]>()

  for (const day of bookableDays) {
    const compactDay: MenteeAvailabilityDay = {
      dateKey: day.dateKey,
      ranges: mergeBookableSlotRanges(day.slots),
      slots: day.slots.map(slot => ({ start: slot.start, end: slot.end })),
    }
    const current = daysByMentor.get(day.mentorId)
    if (current) current.push(compactDay)
    else daysByMentor.set(day.mentorId, [compactDay])
  }

  return mentors
    .flatMap<MenteeAvailabilityMentor>(mentor => {
      const days = daysByMentor.get(mentor.mentorId)
      if (!days?.length) return []
      return [{
        mentorId: mentor.mentorId,
        mentorName: mentor.mentorName,
        tierId: mentor.tierId,
        tierName: mentor.tierName,
        timezone: mentor.timezone,
        weekStartDate: mentor.weekStartDate,
        days: [...days].sort((left, right) => left.dateKey.localeCompare(right.dateKey)),
      }]
    })
    .sort((left, right) => left.mentorName.localeCompare(right.mentorName, 'id-ID') || left.mentorId.localeCompare(right.mentorId))
}

function mentorHasMatchingSchedule(mentor: MenteeAvailabilityMentor, filters: MenteeAvailabilityFilters) {
  if (!filters.date && !filters.timeStart && !filters.timeEnd) return true

  return mentor.days.some(day => {
    if (filters.date && day.dateKey !== filters.date) return false
    return day.slots.some(slot => slotMatchesTimeRange({
      mentorId: mentor.mentorId,
      mentorName: mentor.mentorName,
      timezone: mentor.timezone,
      start: slot.start,
      end: slot.end,
    }, filters.timeStart, filters.timeEnd))
  })
}

export function filterMenteeAvailability(mentors: MenteeAvailabilityMentor[], filters: MenteeAvailabilityFilters) {
  const query = filters.mentorQuery.trim().toLocaleLowerCase('id-ID')
  return mentors.filter(mentor => {
    if (query && !mentor.mentorName.toLocaleLowerCase('id-ID').includes(query)) return false
    if (filters.tierId && mentor.tierId !== filters.tierId) return false
    return mentorHasMatchingSchedule(mentor, filters)
  })
}

export function replaceMenteeMentorAvailability(
  mentors: MenteeAvailabilityMentor[],
  mentorId: string,
  refreshed: MenteeAvailabilityMentor | null,
) {
  const next = mentors.filter(mentor => mentor.mentorId !== mentorId)
  if (refreshed) next.push(refreshed)
  return next.sort((left, right) => left.mentorName.localeCompare(right.mentorName, 'id-ID') || left.mentorId.localeCompare(right.mentorId))
}

export function replaceMenteeMentorDayAvailability(
  mentors: MenteeAvailabilityMentor[],
  mentorId: string,
  dateKey: string,
  refreshed: MenteeAvailabilityMentor | null,
) {
  const current = mentors.find(mentor => mentor.mentorId === mentorId)
  if (!current) return mentors

  const refreshedDay = refreshed?.days.find(day => day.dateKey === dateKey)
  const days = current.days.filter(day => day.dateKey !== dateKey)
  if (refreshedDay) days.push(refreshedDay)
  days.sort((left, right) => left.dateKey.localeCompare(right.dateKey))

  if (!days.length) return replaceMenteeMentorAvailability(mentors, mentorId, null)

  const merged: MenteeAvailabilityMentor = {
    ...current,
    ...(refreshed ? {
      mentorName: refreshed.mentorName,
      tierId: refreshed.tierId,
      tierName: refreshed.tierName,
      timezone: refreshed.timezone,
      weekStartDate: refreshed.weekStartDate,
    } : {}),
    days,
  }
  return replaceMenteeMentorAvailability(mentors, mentorId, merged)
}
