import 'server-only'

import { availabilityWeekOptions, dateInTimeZone } from '@/lib/mentor/availability'
import { createClient } from '@/lib/supabase/server'
import type { MentorProfile } from '@/lib/supabase/database.types'
import type { MentorDashboardData, MentorSessionRow } from './dashboard'

type IntensiveMentorRow={session_id:string;engagement_id:string;mentee_id:string;mentee_name:string|null;mentee_email:string;program_name:string;session_number:number;status:MentorSessionRow['status'];focus_name:string|null;resolved_topic:string|null;scheduled_start_at:string|null;scheduled_end_at:string|null;mentor_timezone:string|null;duration_minutes:number;meeting_url:string|null;google_event_id:string|null;google_ical_uid:string|null;google_sync_status:string;recording_status:string;add_ons:Array<{name:string;code:string}>}

export async function loadMentorDashboardData(mentorId: string, mentor: MentorProfile): Promise<MentorDashboardData> {
  const supabase = await createClient()
  const weeks = availabilityWeekOptions(dateInTimeZone(new Date(), mentor.timezone))
  const weekStarts = weeks.map(week => week.weekStartDate)

  const rpc=supabase as unknown as {rpc<T=unknown>(name:string,args?:Record<string,unknown>):PromiseLike<{data:T|null;error:{message:string}|null}>}
  const privateSessionPromise=rpc.rpc<MentorSessionRow[]>('list_my_mentor_private_mentoring_sessions')
  const intensiveSessionPromise=rpc.rpc<IntensiveMentorRow[]>('list_my_mentor_intensive_mentoring_sessions')
  const tierPromise = mentor.tier_id
    ? supabase.from('mentor_tiers').select('name').eq('id', mentor.tier_id).maybeSingle()
    : Promise.resolve({ data: null, error: null })
  const availabilityPromise = supabase
    .from('mentor_availability_rules')
    .select('week_start_date')
    .eq('mentor_id', mentorId)
    .in('week_start_date', weekStarts)

  const [privateSessionResult,intensiveSessionResult,tierResult,availabilityResult]=await Promise.all([privateSessionPromise,intensiveSessionPromise,tierPromise,availabilityPromise])

  const currentWeek = weeks.find(week => week.kind === 'current')
  const nextWeek = weeks.find(week => week.kind === 'next')
  const availabilityRows = availabilityResult.error ? [] : availabilityResult.data || []
  const privateSessions=privateSessionResult.error?[]:(privateSessionResult.data||[]).map(session=>({...session,mentoring_type:'private' as const,program_name:'Private Mentoring',engagement_id:null,add_ons:[],meeting_url:session.status==='scheduled'?session.meeting_url:null}))
  const intensiveSessions=intensiveSessionResult.error?[]:(intensiveSessionResult.data||[]).map(session=>({session_id:session.session_id,mentoring_type:'intensive' as const,program_name:session.program_name,engagement_id:session.engagement_id,enrollment_id:session.engagement_id,mentee_id:session.mentee_id,mentee_name:session.mentee_name,mentee_email:session.mentee_email,session_number:session.session_number,purchased_sessions:null,status:session.status,focus_name:session.focus_name,resolved_topic:session.resolved_topic,scheduled_start_at:session.scheduled_start_at,scheduled_end_at:session.scheduled_end_at,mentor_timezone:session.mentor_timezone,duration_minutes:session.duration_minutes,meeting_url:session.status==='scheduled'?session.meeting_url:null,google_event_id:session.google_event_id,google_ical_uid:session.google_ical_uid,google_sync_status:session.google_sync_status,add_ons:session.add_ons}))
  const sessions=[...privateSessions,...intensiveSessions]

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
    sessionError: privateSessionResult.error&&intensiveSessionResult.error?'Data sesi mentor belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.':privateSessionResult.error||intensiveSessionResult.error?'Sebagian sesi mentor belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.':null,
    metadataError: tierResult.error || availabilityResult.error
      ? 'Sebagian informasi mentor belum dapat diverifikasi. Data akun utama tetap aman.'
      : null,
  }
}
