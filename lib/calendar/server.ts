import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getGoogleConnectionStatus, listPersonalGoogleEvents } from '@/lib/google-calendar/server'
import { mergeCalendarEvents, type GoogleCalendarEvent, type StrativateCalendarEvent } from './merge'

type AccountShape = { user:{id:string}; profile:{role:'admin'|'mentor'|'mentee'} }

type AnyRow = Record<string, any>

function strativateEvent(row: AnyRow, role: AccountShape['profile']['role']): StrativateCalendarEvent {
  const start = row.scheduled_start_at
  const end = row.scheduled_end_at
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
    menteeId:row.mentee_id ?? null,
    menteeName:row.mentee_name ?? null,
    menteeEmail:role === 'admin' ? row.mentee_email ?? null : null,
    timezone:row.mentor_timezone ?? null,
    durationMinutes:row.duration_minutes ?? (start && end ? Math.round((new Date(end).getTime()-new Date(start).getTime())/60000) : null),
    meetingUrl:row.meeting_url ?? null,
    providerMeetingUrl:role === 'admin' ? row.provider_meeting_url ?? null : null,
    manualMeetingUrl:role === 'admin' ? row.manual_meeting_url ?? null : null,
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
    rows = (result.data ?? []).filter((row:AnyRow) => row.scheduled_start_at && row.scheduled_end_at && row.scheduled_end_at > start && row.scheduled_start_at < end)
  } else {
    const result = await supabase.rpc('list_my_private_mentoring_sessions_v2')
    if (result.error) throw new Error(result.error.message)
    rows = (result.data ?? []).filter((row:AnyRow) => row.scheduled_start_at && row.scheduled_end_at && row.scheduled_end_at > start && row.scheduled_start_at < end)
  }
  const strativate = rows.filter(row=>row.scheduled_start_at && row.scheduled_end_at).map(row=>strativateEvent(row,account.profile.role))
  const connection = await getGoogleConnectionStatus(account.user.id)
  let google: GoogleCalendarEvent[] = []
  let googleError: string | null = null
  if (connection.connected) {
    try { google = await listPersonalGoogleEvents(account.user.id,start,end) as GoogleCalendarEvent[] }
    catch (error) { googleError = error instanceof Error ? error.message : 'Google Calendar sedang tidak dapat disinkronkan.' }
  }
  return { events:mergeCalendarEvents(strativate,google), connection, googleError }
}
