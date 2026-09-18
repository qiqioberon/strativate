import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyZoomWebhook, zoomValidationToken } from '@/lib/zoom/webhook'
import { zoomWebhookEventKey } from '@/lib/zoom/server'

export async function POST(request:Request){
 const raw=await request.text()
 let body:any
 try{body=JSON.parse(raw)}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 if(body?.event==='endpoint.url_validation'&&typeof body?.payload?.plainToken==='string'){
  const plainToken=body.payload.plainToken
  return NextResponse.json({plainToken,encryptedToken:zoomValidationToken(plainToken)})
 }
 if(!verifyZoomWebhook(raw,request.headers.get('x-zm-request-timestamp'),request.headers.get('x-zm-signature'))){
  return NextResponse.json({error:'Invalid Zoom signature.'},{status:401})
 }
 const eventType=String(body?.event||'')
 const object=body?.payload?.object??{}
 const meetingId=object?.id==null?null:String(object.id)
 const key=zoomWebhookEventKey(raw,eventType,body?.event_ts)
 const db=createAdminClient() as any
 const inserted=await db.from('zoom_webhook_events').insert({event_key:key,event_type:eventType,provider_meeting_id:meetingId}).select('event_key').maybeSingle()
 if(inserted.error&&inserted.error.code!=='23505')return NextResponse.json({error:'Webhook could not be recorded.'},{status:500})
 if(!inserted.data)return NextResponse.json({ok:true,deduplicated:true})
 if(meetingId){
  const integration=await db.from('private_mentoring_session_calendar_integrations').select('session_id').eq('provider_meeting_id',meetingId).maybeSingle()
  const sessionId=integration.data?.session_id
  if(sessionId){
   if(eventType==='meeting.started')await db.from('private_mentoring_session_calendar_integrations').update({provider_sync_status:'ready',provider_sync_error:null}).eq('session_id',sessionId)
   if(eventType==='meeting.ended')await db.from('private_mentoring_session_calendar_integrations').update({recording_status:'processing'}).eq('session_id',sessionId).eq('recording_status','expected')
   if(eventType==='recording.completed'){
    const files=Array.isArray(object.recording_files)?object.recording_files.map((file:any)=>({id:file.id??null,file_type:file.file_type??null,recording_type:file.recording_type??null,file_size:file.file_size??null,recording_start:file.recording_start??null,recording_end:file.recording_end??null})):[]
    await db.from('private_mentoring_session_calendar_integrations').update({recording_status:'available',recording_error:null,recording_metadata:{meeting_uuid:object.uuid??null,start_time:object.start_time??null,duration:object.duration??null,files},recording_available_at:new Date().toISOString()}).eq('session_id',sessionId)
   }
   if(eventType==='recording.failed'||eventType==='recording.processing_failed'){
    await db.from('private_mentoring_session_calendar_integrations').update({recording_status:'failed',recording_error:'Zoom reported a recording processing failure.'}).eq('session_id',sessionId)
   }
  }
 }
 return NextResponse.json({ok:true})
}
