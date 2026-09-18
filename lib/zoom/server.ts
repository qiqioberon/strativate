import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const ZOOM_API = 'https://api.zoom.us/v2'
const ZOOM_TOKEN = 'https://zoom.us/oauth/token'

type ZoomContext = {
  sessionId:string
  status:string
  start:string|null
  end:string|null
  sessionNumber:number
  purchasedSessions:number
  topic:string
  mentorId:string|null
  menteeId:string
  meetingProvider:string|null
  providerMeetingId:string|null
  providerMeetingUrl:string|null
  providerSyncStatus:string|null
}
type ZoomMeeting = { id:number|string; join_url?:string; host_id?:string }
let cachedToken:{value:string;expiresAt:number}|null=null

function db(){ return createAdminClient() as any }

function config(){
  const accountId=process.env.ZOOM_ACCOUNT_ID
  const clientId=process.env.ZOOM_CLIENT_ID
  const clientSecret=process.env.ZOOM_CLIENT_SECRET
  const host=process.env.ZOOM_DEFAULT_HOST_USER_ID
  if(!accountId||!clientId||!clientSecret||!host) throw new Error('Zoom Server-to-Server OAuth is not configured.')
  return {accountId,clientId,clientSecret,host}
}

async function json<T>(response:Response):Promise<T>{
  const text=await response.text()
  const parsed=text?JSON.parse(text):{}
  if(!response.ok){
    const message=parsed?.message||parsed?.reason||parsed?.error_description||parsed?.error||'Zoom request failed'
    throw new Error(`${message} (status ${response.status})`)
  }
  return parsed as T
}

async function token(){
  if(cachedToken&&cachedToken.expiresAt>Date.now()+30_000)return cachedToken.value
  const {accountId,clientId,clientSecret}=config()
  const response=await fetch(`${ZOOM_TOKEN}?${new URLSearchParams({grant_type:'account_credentials',account_id:accountId})}`,{
    method:'POST',
    headers:{authorization:'Basic '+Buffer.from(`${clientId}:${clientSecret}`).toString('base64')},
  })
  const body=await json<{access_token?:string;expires_in?:number}>(response)
  if(!body.access_token)throw new Error('Zoom did not return an access token.')
  cachedToken={value:body.access_token,expiresAt:Date.now()+(body.expires_in??3600)*1000}
  return body.access_token
}

async function zoomFetch<T>(path:string,init?:RequestInit):Promise<T>{
  const headers=new Headers(init?.headers)
  headers.set('authorization','Bearer '+await token())
  if(init?.body)headers.set('content-type','application/json')
  return json<T>(await fetch(ZOOM_API+path,{...init,headers}))
}

async function context(sessionId:string):Promise<ZoomContext>{
  const result=await db().rpc('service_get_zoom_meeting_context',{p_session_id:sessionId})
  if(result.error||!result.data)throw new Error(result.error?.message||'Zoom meeting context could not be loaded.')
  return result.data as ZoomContext
}

function durationMinutes(value:ZoomContext){
  if(!value.start||!value.end)return 60
  return Math.max(1,Math.round((new Date(value.end).getTime()-new Date(value.start).getTime())/60000))
}

function meetingBody(value:ZoomContext,autoRecording:'cloud'|'none'){
  if(!value.start)throw new Error('Session must be scheduled before Zoom can be created.')
  return {
    topic:`Strativate Private Mentoring — ${value.topic}`,
    type:2,
    start_time:value.start,
    duration:durationMinutes(value),
    agenda:`Private Mentoring session ${value.sessionNumber}/${value.purchasedSessions}. Reference: ${value.sessionId}`,
    settings:{
      join_before_host:false,
      waiting_room:true,
      participant_video:true,
      host_video:true,
      auto_recording:autoRecording,
    },
  }
}

async function mark(sessionId:string,status:string,error:string|null=null){
  await db().rpc('service_mark_zoom_sync',{p_session_id:sessionId,p_status:status,p_error:error})
}

async function store(sessionId:string,meeting:ZoomMeeting,recordingStatus:string,recordingError:string|null){
  if(!meeting.id||!meeting.join_url)throw new Error('Zoom did not return a meeting id and join URL.')
  const result=await db().rpc('service_store_zoom_meeting',{
    p_session_id:sessionId,
    p_meeting_id:String(meeting.id),
    p_join_url:meeting.join_url,
    p_host_id:meeting.host_id??config().host,
    p_recording_status:recordingStatus,
    p_recording_error:recordingError,
  })
  if(result.error)throw new Error(result.error.message)
}

function legacy(value:ZoomContext){
  return value.meetingProvider==='google_meet'||value.meetingProvider==='manual'
}

export async function reconcileZoomMeeting(sessionId:string){
  let value=await context(sessionId)
  if(value.status==='cancelled')return cancelZoomMeeting(sessionId)
  if(legacy(value))return {status:'ready' as const,meetingId:value.providerMeetingId,meetingUrl:value.providerMeetingUrl,legacy:true}
  if(!value.start||!value.end)return {status:'pending' as const,meetingId:value.providerMeetingId,meetingUrl:value.providerMeetingUrl,error:'Session is not scheduled.'}

  const claim=await db().rpc('service_claim_zoom_meeting_creation',{p_session_id:sessionId})
  if(claim.error)throw new Error(claim.error.message)
  if(claim.data==='legacy'){
    value=await context(sessionId)
    return {status:'ready' as const,meetingId:value.providerMeetingId,meetingUrl:value.providerMeetingUrl,legacy:true}
  }
  if(claim.data==='wait'){
    value=await context(sessionId)
    return {status:'pending' as const,meetingId:value.providerMeetingId,meetingUrl:value.providerMeetingUrl}
  }

  try{
    if(claim.data==='update'&&value.providerMeetingId){
      await zoomFetch<void>(`/meetings/${encodeURIComponent(value.providerMeetingId)}`,{method:'PATCH',body:JSON.stringify(meetingBody(value,'cloud'))})
      await mark(sessionId,'ready',null)
      value=await context(sessionId)
      return {status:'ready' as const,meetingId:value.providerMeetingId,meetingUrl:value.providerMeetingUrl}
    }

    const {host}=config()
    let recordingStatus='expected'
    let recordingError:string|null=null
    let meeting:ZoomMeeting
    try{
      meeting=await zoomFetch<ZoomMeeting>(`/users/${encodeURIComponent(host)}/meetings`,{method:'POST',body:JSON.stringify(meetingBody(value,'cloud'))})
    }catch(error){
      const message=error instanceof Error?error.message:'Zoom cloud recording is unavailable.'
      if(!/record|cloud/i.test(message))throw error
      recordingStatus='unavailable'
      recordingError=message
      meeting=await zoomFetch<ZoomMeeting>(`/users/${encodeURIComponent(host)}/meetings`,{method:'POST',body:JSON.stringify(meetingBody(value,'none'))})
    }
    await store(sessionId,meeting,recordingStatus,recordingError)
    return {status:'ready' as const,meetingId:String(meeting.id),meetingUrl:meeting.join_url??null,recordingStatus,recordingError}
  }catch(error){
    const message=error instanceof Error?error.message:'Zoom meeting reconciliation failed.'
    await mark(sessionId,'failed',message)
    return {status:'failed' as const,meetingId:value.providerMeetingId,meetingUrl:value.providerMeetingUrl,error:message}
  }
}

export async function cancelZoomMeeting(sessionId:string){
  const value=await context(sessionId)
  if(legacy(value)||!value.providerMeetingId){
    if(!legacy(value))await mark(sessionId,'cancelled',null)
    return {status:'cancelled' as const,meetingId:value.providerMeetingId,legacy:legacy(value)}
  }
  try{
    try{
      await zoomFetch<void>(`/meetings/${encodeURIComponent(value.providerMeetingId)}`,{method:'DELETE'})
    }catch(error){
      if(!(error instanceof Error)||!/(status 404|status 400|does not exist|3001)/i.test(error.message))throw error
    }
    await mark(sessionId,'cancelled',null)
    return {status:'cancelled' as const,meetingId:value.providerMeetingId}
  }catch(error){
    const message=error instanceof Error?error.message:'Zoom meeting cancellation failed.'
    await mark(sessionId,'failed',message)
    return {status:'failed' as const,meetingId:value.providerMeetingId,error:message}
  }
}

export function zoomWebhookEventKey(rawBody:string,eventType:string,eventTs:unknown){
  return createHash('sha256').update(`${eventType}:${String(eventTs??'')}:${rawBody}`).digest('hex')
}
