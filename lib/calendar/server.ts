import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getGoogleConnectionStatus, listPersonalGoogleEvents } from '@/lib/google-calendar/server'
import { mergeCalendarEvents, type GoogleCalendarEvent, type StrativateCalendarEvent } from './merge'

type AccountShape = { user:{id:string}; profile:{role:'admin'|'mentor'|'mentee'} }
type AnyRow = Record<string, any>

function strativateEvent(row: AnyRow, role: AccountShape['profile']['role'], accountUserId:string, colors:Map<string,string>): StrativateCalendarEvent {
  const start = row.scheduled_start_at
  const end = row.scheduled_end_at
  const personId = role === 'mentee' ? accountUserId : row.mentee_id ?? accountUserId
  const personName = role === 'mentee' ? 'Saya' : (row.mentee_name ?? row.mentee_email ?? 'Mentee')
  return {
    id: row.session_id,
    source:'strativate',
    title:`Private Mentoring · Sesi ${row.session_number}`,
    start,
    end,
    googleEventId:row.google_event_id ?? null,
    googleICalUid:row.google_ical_uid ?? null,
    sessionId:row.session_id,
    enrollmentId:row.enrollment_id,
    sessionNumber:row.session_number,
    purchasedSessions:row.purchased_sessions,
    focusName:row.focus_name ?? null,
    status:row.status,
    mentorId:row.mentor_id ?? null,
    mentorName:row.mentor_name ?? null,
    mentorTierName:row.mentor_tier_name ?? null,
    menteeId:row.mentee_id ?? (role === 'mentee' ? accountUserId : null),
    menteeName:row.mentee_name ?? (role === 'mentee' ? 'Saya' : null),
    menteeEmail:role === 'admin' ? row.mentee_email ?? null : null,
    personId,
    personName,
    personColor:colors.get(personId) ?? null,
    timezone:row.mentor_timezone ?? null,
    durationMinutes:row.duration_minutes ?? (start && end ? Math.round((new Date(end).getTime()-new Date(start).getTime())/60000) : null),
    meetingUrl:row.status === 'scheduled' ? row.meeting_url ?? null : null,
    providerMeetingUrl:role === 'admin' && row.status === 'scheduled' ? row.provider_meeting_url ?? null : null,
    manualMeetingUrl:role === 'admin' && row.status === 'scheduled' ? row.manual_meeting_url ?? null : null,
    googleSyncStatus:row.google_sync_status ?? 'pending',
    googleSyncError:role === 'admin' ? row.google_sync_error ?? null : null,
  }
}

export async function loadCalendarEvents(account: AccountShape, start: string, end: string) {
  const supabase = await createClient() as any
  let rows: AnyRow[] = []
  if (account.profile.role === 'admin') {
    const result = await supabase.rpc('list_admin_private_mentoring_calendar_sessions',{p_from:start,p_to:end})
    if (result.error) throw new Error(result.error.message)
    rows = result.data ?? []
  } else if (account.profile.role === 'mentor') {
    const result = await supabase.rpc('list_my_mentor_private_mentoring_sessions')
    if (result.error) throw new Error(result.error.message)
    rows = (result.data ?? []).filter((row:AnyRow) => row.status !== 'cancelled' && row.scheduled_start_at && row.scheduled_end_at && row.scheduled_end_at > start && row.scheduled_start_at < end)
  } else {
    const result = await supabase.rpc('list_my_private_mentoring_sessions_v2')
    if (result.error) throw new Error(result.error.message)
    rows = (result.data ?? []).filter((row:AnyRow) => row.status !== 'cancelled' && row.scheduled_start_at && row.scheduled_end_at && row.scheduled_end_at > start && row.scheduled_start_at < end)
  }

  const personIds = [...new Set(rows.map(row => account.profile.role === 'mentee' ? account.user.id : row.mentee_id).filter(Boolean) as string[])]
  const colorResults = await Promise.all(personIds.map(async personId => {
    const result = await supabase.rpc('get_calendar_person_color',{p_user_id:personId})
    return [personId, result.error ? null : result.data] as const
  }))
  const colors = new Map(colorResults.flatMap(([personId,color]) => typeof color === 'string' ? [[personId,color] as const] : []))

  const strativate = rows
    .filter(row=>row.status !== 'cancelled' && row.scheduled_start_at && row.scheduled_end_at)
    .map(row=>strativateEvent(row,account.profile.role,account.user.id,colors))
  const connection = await getGoogleConnectionStatus(account.user.id)
  let google: GoogleCalendarEvent[] = []
  let googleError: string | null = null
  if (connection.connected) {
    try { google = await listPersonalGoogleEvents(account.user.id,start,end) as GoogleCalendarEvent[] }
    catch (error) { googleError = error instanceof Error ? error.message : 'Google Calendar sedang tidak dapat disinkronkan.' }
  }
  return { events:mergeCalendarEvents(strativate,google), connection, googleError }
}
