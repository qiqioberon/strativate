import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyZoomWebhook, zoomValidationToken } from '@/lib/zoom/webhook'
import { zoomWebhookEventKey } from '@/lib/zoom/server'

export const runtime = 'nodejs'

type ZoomRecordingFile = {
 id?:unknown
 file_type?:unknown
 recording_type?:unknown
 file_size?:unknown
 recording_start?:unknown
 recording_end?:unknown
}
type ZoomWebhookObject = {
 id?:unknown
 uuid?:unknown
 start_time?:unknown
 duration?:unknown
 recording_files?:unknown
}
type ZoomWebhookBody = {
 event?:unknown
 event_ts?:unknown
 payload?:{
  plainToken?:unknown
  object?:ZoomWebhookObject
 }
}

function configurationError(error:unknown){
 return NextResponse.json({error:error instanceof Error?error.message:'Zoom webhook validation is not configured.'},{status:500})
}

export async function POST(request:Request){
 const raw=await request.text()
 let body:ZoomWebhookBody
 try{body=JSON.parse(raw) as ZoomWebhookBody}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}

 if(body?.event==='endpoint.url_validation'&&typeof body?.payload?.plainToken==='string'){
  const plainToken=body.payload.plainToken
  try{return NextResponse.json({plainToken,encryptedToken:zoomValidationToken(plainToken)})}
  catch(error){return configurationError(error)}
 }

 let verified=false
 try{verified=verifyZoomWebhook(raw,request.headers.get('x-zm-request-timestamp'),request.headers.get('x-zm-signature'))}
 catch(error){return configurationError(error)}
 if(!verified)return NextResponse.json({error:'Invalid Zoom signature.'},{status:401})

 const eventType=String(body?.event||'')
 const object=body?.payload?.object??{}
 const meetingId=object?.id==null?null:String(object.id)
 const key=zoomWebhookEventKey(raw,eventType,body?.event_ts)
 const db=createAdminClient() as unknown as SupabaseClient
 const inserted=await db.from('zoom_webhook_events').insert({event_key:key,event_type:eventType,provider_meeting_id:meetingId}).select('event_key').maybeSingle()
 if(inserted.error&&inserted.error.code!=='23505')return NextResponse.json({error:'Webhook could not be recorded.'},{status:500})
 if(!inserted.data)return NextResponse.json({ok:true,deduplicated:true})

 if(meetingId){
  let table:'private_mentoring_session_calendar_integrations'|'intensive_mentoring_session_calendar_integrations'='private_mentoring_session_calendar_integrations'
  let integration=await db.from(table).select('session_id').eq('provider_meeting_id',meetingId).maybeSingle()
  if(!integration.data?.session_id){
   table='intensive_mentoring_session_calendar_integrations'
   integration=await db.from(table).select('session_id').eq('provider_meeting_id',meetingId).maybeSingle()
  }
  const sessionId=integration.data?.session_id
  if(sessionId){
   const target=db.from(table)
   if(eventType==='meeting.started')await target.update({provider_sync_status:'ready',provider_sync_error:null}).eq('session_id',sessionId)
   if(eventType==='meeting.ended')await target.update({recording_status:'processing'}).eq('session_id',sessionId).eq('recording_status','expected')
   if(eventType==='recording.completed'){
    const files=Array.isArray(object.recording_files)?(object.recording_files as ZoomRecordingFile[]).map(file=>({id:file.id??null,file_type:file.file_type??null,recording_type:file.recording_type??null,file_size:file.file_size??null,recording_start:file.recording_start??null,recording_end:file.recording_end??null})):[]
    await target.update({recording_status:'available',recording_error:null,recording_metadata:{meeting_uuid:object.uuid??null,start_time:object.start_time??null,duration:object.duration??null,files},recording_available_at:new Date().toISOString()}).eq('session_id',sessionId)
   }
   if(eventType==='recording.failed'||eventType==='recording.processing_failed')await target.update({recording_status:'failed',recording_error:'Zoom reported a recording processing failure.'}).eq('session_id',sessionId)
  }
 }
 return NextResponse.json({ok:true})
}
