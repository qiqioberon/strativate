import 'server-only'

import { buildBookableSlots, type SlotMentor, type TimeInterval } from '@/lib/calendar/slot-engine'
import { getGoogleFreeBusy } from '@/lib/google-calendar/server'
import { availabilityWeekOptions, dateInTimeZone } from '@/lib/mentor/availability'
import {
  buildMenteeAvailabilityMentors,
  type MenteeAvailabilityPayload,
  type MenteeAvailabilityTier,
  type MenteeDiscoveryMentorInput,
} from '@/lib/private-mentoring/mentee-availability'
import { createAdminClient } from '@/lib/supabase/admin'

type MentorProfileRow = {
  user_id: string
  tier_id: string | null
  timezone: string
  is_active: boolean
}

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  username: string | null
  role: string
}

type TierRow = {
  id: string
  code: string
  name: string
  sort_order: number
  is_active: boolean
}

type AvailabilityRuleRow = {
  mentor_id: string
  week_start_date: string
  day_of_week: number
  start_time: string
  end_time: string
}

type BusySessionRow = {
  mentor_id: string | null
  scheduled_start_at: string | null
  scheduled_end_at: string | null
}

type PackageRow = { duration_minutes: number }

type MentorBase = MenteeDiscoveryMentorInput & {
  strativateBusy: TimeInterval[]
}

function addIsoDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function timeZoneOffsetMinutes(instant: number, timezone: string) {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
    hour: '2-digit',
  }).formatToParts(new Date(instant)).find(item => item.type === 'timeZoneName')?.value
  if (!part || part === 'GMT' || part === 'UTC') return 0
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(part)
  if (!match) throw new Error('Zona waktu mentor belum dapat diproses.')
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return match[1] === '-' ? -minutes : minutes
}

function localDateTimeToIso(dateKey: string, clock: string, timezone: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute, second = 0] = clock.split(':').map(Number)
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second)
  let instant = wallClock - timeZoneOffsetMinutes(wallClock, timezone) * 60_000
  const corrected = wallClock - timeZoneOffsetMinutes(instant, timezone) * 60_000
  if (corrected !== instant) instant = corrected
  return new Date(instant).toISOString()
}

function mentorName(profile: ProfileRow | undefined) {
  if (!profile) return 'Mentor Strativate'
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username || 'Mentor Strativate'
}

function fallbackWindow(now: Date) {
  const current = availabilityWeekOptions(dateInTimeZone(now, 'Asia/Jakarta'))[0]
  return { windowStart: current.weekStartDate, windowEnd: addIsoDays(current.weekStartDate, 13) }
}

function controlledError(message: string) {
  return new Error(message)
}

export async function getMenteeMentorAvailability(options: { mentorId?: string; date?: string } = {}): Promise<MenteeAvailabilityPayload> {
  const admin = createAdminClient()
  const now = new Date()

  let mentorProfilesQuery = admin
    .from('mentor_profiles')
    .select('user_id,tier_id,timezone,is_active')
    .eq('is_active', true)
    .not('tier_id', 'is', null)
  if (options.mentorId) mentorProfilesQuery = mentorProfilesQuery.eq('user_id', options.mentorId)

  const [mentorProfilesResult, tiersResult, packagesResult] = await Promise.all([
    mentorProfilesQuery,
    admin.from('mentor_tiers').select('id,code,name,sort_order,is_active').eq('is_active', true).order('sort_order').order('name'),
    admin.from('private_mentoring_packages').select('duration_minutes').eq('is_active', true),
  ])

  if (mentorProfilesResult.error) throw controlledError('Ketersediaan mentor belum dapat dimuat.')
  if (tiersResult.error) throw controlledError('Level mentor belum dapat dimuat.')
  if (packagesResult.error) throw controlledError('Durasi sesi mentoring belum dapat dimuat.')

  const tierRows = (tiersResult.data ?? []) as TierRow[]
  const tiers: MenteeAvailabilityTier[] = tierRows.map(tier => ({ id: tier.id, code: tier.code, name: tier.name }))
  const tierById = new Map(tierRows.map(tier => [tier.id, tier]))
  const durations = [...new Set(((packagesResult.data ?? []) as PackageRow[]).map(row => row.duration_minutes).filter(value => Number.isInteger(value) && value > 0))]
  if (durations.length !== 1) {
    throw controlledError('Ketersediaan mentor belum dapat ditampilkan karena durasi sesi aktif belum konsisten.')
  }
  const durationMinutes = durations[0]
  const mentorProfiles = ((mentorProfilesResult.data ?? []) as MentorProfileRow[]).filter(row => row.tier_id && tierById.has(row.tier_id))
  const mentorIds = mentorProfiles.map(row => row.user_id)
  const fallback = fallbackWindow(now)

  if (!mentorIds.length) {
    return { generatedAt: now.toISOString(), durationMinutes, ...fallback, tiers, mentors: [] }
  }

  const weekStartsByMentor = new Map<string, string[]>()
  for (const mentor of mentorProfiles) {
    const weeks = availabilityWeekOptions(dateInTimeZone(now, mentor.timezone))
    weekStartsByMentor.set(mentor.user_id, weeks.map(week => week.weekStartDate))
  }
  const currentWeekStarts = [...weekStartsByMentor.values()].map(weeks => weeks[0])
  const expectedWeekStarts = [...weekStartsByMentor.values()].flat()
  const minWindowStart = currentWeekStarts.reduce((min, value) => value < min ? value : min, currentWeekStarts[0])
  const maxWindowStart = currentWeekStarts.reduce((max, value) => value > max ? value : max, currentWeekStarts[0])
  const minRuleWeekStart = expectedWeekStarts.reduce((min, value) => value < min ? value : min, expectedWeekStarts[0])
  const maxRuleWeekStart = expectedWeekStarts.reduce((max, value) => value > max ? value : max, expectedWeekStarts[0])

  const [profilesResult, rulesResult] = await Promise.all([
    admin.from('profiles').select('id,first_name,last_name,username,role').in('id', mentorIds).eq('role', 'mentor'),
    admin.from('mentor_availability_rules')
      .select('mentor_id,week_start_date,day_of_week,start_time,end_time')
      .in('mentor_id', mentorIds)
      .gte('week_start_date', minRuleWeekStart)
      .lte('week_start_date', maxRuleWeekStart),
  ])
  if (profilesResult.error || rulesResult.error) throw controlledError('Ketersediaan mentor belum dapat dimuat.')

  const profileById = new Map(((profilesResult.data ?? []) as ProfileRow[]).map(profile => [profile.id, profile]))
  const rules = (rulesResult.data ?? []) as AvailabilityRuleRow[]
  const baseMentors: MentorBase[] = mentorProfiles.flatMap(mentor => {
    const tier = mentor.tier_id ? tierById.get(mentor.tier_id) : undefined
    if (!tier) return []
    const expected = new Set(weekStartsByMentor.get(mentor.user_id) ?? [])
    const mentorRules = rules.filter(rule => rule.mentor_id === mentor.user_id && expected.has(rule.week_start_date))
    const availability = mentorRules.flatMap(rule => {
      const dateKey = addIsoDays(rule.week_start_date, rule.day_of_week - 1)
      if (options.date && dateKey !== options.date) return []
      return [{
        start: localDateTimeToIso(dateKey, rule.start_time, mentor.timezone),
        end: localDateTimeToIso(dateKey, rule.end_time, mentor.timezone),
      }]
    }).sort((left, right) => left.start.localeCompare(right.start))
    if (!availability.length) return []
    return [{
      mentorId: mentor.user_id,
      mentorName: mentorName(profileById.get(mentor.user_id)),
      tierId: tier.id,
      tierName: tier.name,
      timezone: mentor.timezone,
      weekStartDate: (weekStartsByMentor.get(mentor.user_id) ?? [fallback.windowStart])[0],
      availability,
      strativateBusy: [],
    }]
  })

  if (!baseMentors.length) {
    return {
      generatedAt: now.toISOString(),
      durationMinutes,
      windowStart: minWindowStart,
      windowEnd: addIsoDays(maxWindowStart, 13),
      tiers,
      mentors: [],
    }
  }

  const allAvailability = baseMentors.flatMap(mentor => mentor.availability)
  const horizonStart = allAvailability.reduce((min, range) => range.start < min ? range.start : min, allAvailability[0].start)
  const horizonEnd = allAvailability.reduce((max, range) => range.end > max ? range.end : max, allAvailability[0].end)
  const busyQuery = admin.from('private_mentoring_sessions')
    .select('mentor_id,scheduled_start_at,scheduled_end_at')
    .in('mentor_id', baseMentors.map(mentor => mentor.mentorId))
    .in('status', ['scheduled', 'completed'])
    .not('scheduled_start_at', 'is', null)
    .not('scheduled_end_at', 'is', null)
    .lt('scheduled_start_at', horizonEnd)
    .gt('scheduled_end_at', horizonStart)

  const googleBusyPromise = Promise.all(baseMentors.map(async mentor => {
    const mentorStart = mentor.availability[0].start
    const mentorEnd = mentor.availability.reduce((max, range) => range.end > max ? range.end : max, mentor.availability[0].end)
    try {
      return [mentor.mentorId, await getGoogleFreeBusy(mentor.mentorId, mentorStart, mentorEnd)] as const
    } catch {
      return [mentor.mentorId, [] as TimeInterval[]] as const
    }
  }))

  const [busyResult, googleBusyEntries] = await Promise.all([busyQuery, googleBusyPromise])
  if (busyResult.error) throw controlledError('Bentrok jadwal mentor belum dapat diverifikasi.')

  const busyByMentor = new Map<string, TimeInterval[]>()
  for (const row of (busyResult.data ?? []) as BusySessionRow[]) {
    if (!row.mentor_id || !row.scheduled_start_at || !row.scheduled_end_at) continue
    const current = busyByMentor.get(row.mentor_id)
    const interval = { start: row.scheduled_start_at, end: row.scheduled_end_at }
    if (current) current.push(interval)
    else busyByMentor.set(row.mentor_id, [interval])
  }
  const googleBusyByMentor = new Map<string, TimeInterval[]>(googleBusyEntries)

  const slotMentors = baseMentors.map(mentor => ({
    mentorId: mentor.mentorId,
    mentorName: mentor.mentorName,
    tierId: mentor.tierId,
    active: true,
    timezone: mentor.timezone,
    availability: mentor.availability,
    strativateBusy: busyByMentor.get(mentor.mentorId) ?? [],
    googleBusy: googleBusyByMentor.get(mentor.mentorId) ?? [],
  } satisfies SlotMentor))

  const tierIds = [...new Set(baseMentors.map(mentor => mentor.tierId))]
  const slots = tierIds.flatMap(requiredTierId => buildBookableSlots({
    now: now.toISOString(),
    durationMinutes,
    requiredTierId,
    stepMinutes: 15,
    mentors: slotMentors,
  }))

  return {
    generatedAt: now.toISOString(),
    durationMinutes,
    windowStart: minWindowStart,
    windowEnd: addIsoDays(maxWindowStart, 13),
    tiers,
    mentors: buildMenteeAvailabilityMentors({ mentors: baseMentors, slots }),
  }
}
