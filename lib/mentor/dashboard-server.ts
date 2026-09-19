import 'server-only'

import { availabilityWeekOptions, dateInTimeZone } from '@/lib/mentor/availability'
import { createClient } from '@/lib/supabase/server'
import type { MentorProfile } from '@/lib/supabase/database.types'
import type { MentorDashboardData, MentorSessionRow } from './dashboard'

type RpcResult = {
  data: MentorSessionRow[] | null
  error: { message: string } | null
}

export async function loadMentorDashboardData(mentorId: string, mentor: MentorProfile): Promise<MentorDashboardData> {
  const supabase = await createClient()
  const weeks = availabilityWeekOptions(dateInTimeZone(new Date(), mentor.timezone))
  const weekStarts = weeks.map(week => week.weekStartDate)

  const sessionPromise = (supabase as unknown as {
    rpc(name: 'list_my_mentor_private_mentoring_sessions'): PromiseLike<RpcResult>
  }).rpc('list_my_mentor_private_mentoring_sessions')
  const tierPromise = mentor.tier_id
    ? supabase.from('mentor_tiers').select('name').eq('id', mentor.tier_id).maybeSingle()
    : Promise.resolve({ data: null, error: null })
  const availabilityPromise = supabase
    .from('mentor_availability_rules')
    .select('week_start_date')
    .eq('mentor_id', mentorId)
    .in('week_start_date', weekStarts)

  const [sessionResult, tierResult, availabilityResult] = await Promise.all([
    sessionPromise,
    tierPromise,
    availabilityPromise,
  ])

  const currentWeek = weeks.find(week => week.kind === 'current')
  const nextWeek = weeks.find(week => week.kind === 'next')
  const availabilityRows = availabilityResult.error ? [] : availabilityResult.data || []
  const sessions = sessionResult.error ? [] : (sessionResult.data || []).map(session =>
    session.status === 'scheduled' ? session : { ...session, meeting_url:null }
  )

  return {
    sessions,
    tierName: tierResult.error ? null : tierResult.data?.name || null,
    timezone: mentor.timezone,
    isActive: mentor.is_active,
    availability: {
      current: availabilityResult.error || !currentWeek
        ? null
        : availabilityRows.some(rule => rule.week_start_date === currentWeek.weekStartDate),
      next: availabilityResult.error || !nextWeek
        ? null
        : availabilityRows.some(rule => rule.week_start_date === nextWeek.weekStartDate),
    },
    sessionError: sessionResult.error ? 'Data sesi mentor belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.' : null,
    metadataError: tierResult.error || availabilityResult.error
      ? 'Sebagian informasi mentor belum dapat diverifikasi. Data akun utama tetap aman.'
      : null,
  }
}
