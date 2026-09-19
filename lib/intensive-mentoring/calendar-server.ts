import 'server-only'

import type {SupabaseClient} from '@supabase/supabase-js'
import {createAdminClient} from '@/lib/supabase/admin'
import {GoogleCalendarRestProvider} from '@/lib/google-calendar/server'
import {reconcileSessionEvent} from '@/lib/google-calendar/sync'

type SyncContext={sessionId:string;sessionNumber:number;purchasedSessions:number|null;status:string;focusName:string|null;resolvedTopic:string|null;start:string|null;end:string|null;menteeEmail:string;mentorEmail:string|null;organizerUserId:string|null;calendarId:string;eventId:string|null;iCalUID:string|null;providerMeetingUrl:string|null;manualMeetingUrl:string|null}
function db(){return createAdminClient() as unknown as SupabaseClient}

export async function syncIntensiveMentoringSession(sessionId:string,currentAdminId?:string|null){
 const admin=db()
 const{data,error}=await admin.rpc('service_get_intensive_mentoring_sync_context',{p_session_id:sessionId})
 if(error||!data)throw new Error(error?.message||'Intensive session sync context could not be loaded.')
 const context=data as SyncContext
 const organizerUserId=context.organizerUserId||currentAdminId
 if(!organizerUserId)throw new Error('Google Calendar organizer is not available.')
 const cancelled=context.status==='cancelled'
 if(!cancelled&&(!context.start||!context.end||!context.mentorEmail))throw new Error('Session is not fully scheduled.')
 const integration=admin.from('intensive_mentoring_session_calendar_integrations')
 await integration.upsert({session_id:sessionId,organizer_user_id:organizerUserId,google_calendar_id:context.calendarId||'primary',sync_status:'pending',sync_error:null},{onConflict:'session_id'})
 try{
  const sequence=context.purchasedSessions?`${context.sessionNumber}/${context.purchasedSessions}`:String(context.sessionNumber)
  const result=await reconcileSessionEvent(context.status,{
   sessionId,
   calendarId:context.calendarId||'primary',
   eventId:context.eventId,
   summary:`Strativate Intensive Mentoring — ${context.focusName||'Mentoring Session'}`,
   description:`Session ${sequence}\nStrativate Intensive Mentoring\nMeeting: ${context.manualMeetingUrl||context.providerMeetingUrl||'pending'}\nSession reference: ${sessionId}`,
   start:context.start||'',
   end:context.end||'',
   attendees:[context.menteeEmail,context.mentorEmail||''],
   manualMeetingUrl:context.manualMeetingUrl,
   providerMeetingUrl:context.providerMeetingUrl,
  },new GoogleCalendarRestProvider(organizerUserId))
  if(result.kind==='cancelled'){
   await integration.update({organizer_user_id:organizerUserId,sync_status:'cancelled',sync_error:null,last_synced_at:new Date().toISOString()}).eq('session_id',sessionId)
   return{status:'cancelled' as const,meetingUrl:null,eventId:context.eventId}
  }
  const effective=context.manualMeetingUrl||context.providerMeetingUrl
  const syncStatus=effective?'synced':'pending'
  await integration.update({organizer_user_id:organizerUserId,google_event_id:result.eventId,google_ical_uid:result.iCalUID,sync_status:syncStatus,sync_error:null,last_synced_at:new Date().toISOString()}).eq('session_id',sessionId)
  return{status:syncStatus,meetingUrl:result.effectiveMeetingUrl,eventId:result.eventId}
 }catch(value){
  const message=value instanceof Error?value.message:'Google Calendar synchronization failed.'
  await integration.update({sync_status:'failed',sync_error:message,last_synced_at:new Date().toISOString()}).eq('session_id',sessionId)
  return{status:'failed' as const,meetingUrl:cancelled?null:context.manualMeetingUrl||context.providerMeetingUrl,error:message,eventId:context.eventId}
 }
}

export async function setIntensiveManualMeetingUrl(sessionId:string,url:string|null){
 if(url){const parsed=new URL(url);if(parsed.protocol!=='https:')throw new Error('Meeting link must use HTTPS.')}
 const{error}=await db().from('intensive_mentoring_session_calendar_integrations').update({manual_meeting_url:url}).eq('session_id',sessionId)
 if(error)throw new Error('Meeting link could not be updated.')
}
