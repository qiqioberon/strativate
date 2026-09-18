import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setManualMeetingUrl, syncPrivateMentoringSession } from '@/lib/google-calendar/server'

async function requireAdmin(){
 const account=await requireAccount()
 if(account.profile.role!=='admin')return null
 return account
}
async function state(sessionId:string){
 const db=createAdminClient() as any
 const {data,error}=await db.from('private_mentoring_session_calendar_integrations')
  .select('session_id,meeting_provider,provider_meeting_id,provider_meeting_url,manual_meeting_url,provider_sync_status,provider_sync_error,recording_status,recording_error,sync_status,sync_error')
  .eq('session_id',sessionId).maybeSingle()
 if(error)throw new Error('Meeting state belum dapat dimuat.')
 const session=await db.from('private_mentoring_sessions').select('status').eq('id',sessionId).maybeSingle()
 return{
  sessionId,
  status:session.data?.status??'unknown',
  meetingProvider:data?.meeting_provider??null,
  providerMeetingId:data?.provider_meeting_id??null,
  providerMeetingUrl:data?.provider_meeting_url??null,
  manualMeetingUrl:data?.manual_meeting_url??null,
  effectiveMeetingUrl:session.data?.status==='cancelled'?null:(data?.manual_meeting_url??data?.provider_meeting_url??null),
  providerSyncStatus:data?.provider_sync_status??'pending',
  providerSyncError:data?.provider_sync_error??null,
  calendarSyncStatus:data?.sync_status??'pending',
  calendarSyncError:data?.sync_error??null,
  recordingStatus:data?.recording_status??'expected',
  recordingError:data?.recording_error??null,
 }
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 if(!await requireAdmin())return NextResponse.json({error:'Forbidden'},{status:403})
 const{id}=await params
 try{return NextResponse.json(await state(id))}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Meeting state belum dapat dimuat.'},{status:400})}
}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
 const account=await requireAdmin()
 if(!account)return NextResponse.json({error:'Forbidden'},{status:403})
 const{id}=await params
 try{
  const body=await request.json() as{url?:unknown}
  if(body.url!==null&&typeof body.url!=='string')return NextResponse.json({error:'Meeting URL tidak valid.'},{status:400})
  await setManualMeetingUrl(id,body.url as string|null)
  const calendar=await syncPrivateMentoringSession(id,account.user.id)
  return NextResponse.json({...await state(id),calendar})
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Meeting link belum dapat diubah.'},{status:400})
 }
}
