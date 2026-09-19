export type TimeInterval = { start: string; end: string }
export type SlotMentor = {
  mentorId: string
  mentorName: string
  tierId: string | null
  active: boolean
  timezone: string
  availability: TimeInterval[]
  strativateBusy: TimeInterval[]
  googleBusy: TimeInterval[]
}
export type BookableSlot = { mentorId: string; mentorName: string; timezone: string; start: string; end: string }

type BuildBookableSlotsInput = {
  now: string
  durationMinutes: number
  requiredTierId: string | null
  stepMinutes?: number
  mentors: SlotMentor[]
}

function millis(value: string) { return new Date(value).getTime() }
function overlaps(start: number, end: number, interval: TimeInterval) {
  return start < millis(interval.end) && end > millis(interval.start)
}
function iso(value: number) { return new Date(value).toISOString() }

export function dateKeyInTimeZone(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

export function buildBookableSlots(input: BuildBookableSlotsInput): BookableSlot[] {
  const duration = input.durationMinutes * 60_000
  const step = (input.stepMinutes ?? 15) * 60_000
  const now = millis(input.now)
  if (!Number.isFinite(now) || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(step) || step <= 0) return []

  const slots: BookableSlot[] = []
  for (const mentor of input.mentors) {
    if (!mentor.active || (input.requiredTierId && mentor.tierId !== input.requiredTierId)) continue
    const busy = [...mentor.strativateBusy, ...mentor.googleBusy]
    for (const range of mentor.availability) {
      const rangeStart = millis(range.start)
      const rangeEnd = millis(range.end)
      if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) continue
      const first = now <= rangeStart ? rangeStart : rangeStart + Math.ceil((now - rangeStart) / step) * step
      for (let start = first; start + duration <= rangeEnd; start += step) {
        const end = start + duration
        if (busy.some(interval => overlaps(start, end, interval))) continue
        slots.push({ mentorId: mentor.mentorId, mentorName: mentor.mentorName, timezone: mentor.timezone, start: iso(start), end: iso(end) })
      }
    }
  }
  return slots.sort((a, b) => millis(a.start) - millis(b.start) || a.mentorName.localeCompare(b.mentorName) || a.mentorId.localeCompare(b.mentorId))
}
