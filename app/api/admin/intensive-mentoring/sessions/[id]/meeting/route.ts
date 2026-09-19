import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {requireAccount} from '@/lib/auth/server'
import {setIntensiveManualMeetingUrl,syncIntensiveMentoringSession} from '@/lib/intensive-mentoring/calendar-server'
import {humanizeProviderError} from '@/lib/operations/provider-errors'
import {createAdminClient} from '@/lib/supabase/admin'

async function requireAdmin(){const account=await requireAccount();return account.profile.role==='admin'?account:null}
async function state(sessionId:string){
 const db=createAdminClient() as unknown as SupabaseClient
 const{data,error}=await db.from('intensive_mentoring_session_calendar_integrations').select('session_id,meeting_provider,provider_meeting_id,provider_meeting_url,manual_meeting_url,provider_sync_status,provider_sync_error,recording_status,recording_error,sync_status,sync_error').eq('session_id',sessionId).maybeSingle()
 if(error)throw new Error('Meeting state belum dapat dimuat.')
 const session=await db.from('intensive_mentoring_sessions').select('status').eq('id',sessionId).maybeSingle(),status=session.data?.status??'unknown',historical=status==='completed'||status==='cancelled'
 return{sessionId,status,meetingProvider:historical?null:(data?.meeting_provider??null),providerMeetingId:data?.provider_meeting_id??null,providerMeetingUrl:historical?null:(data?.provider_meeting_url??null),manualMeetingUrl:historical?null:(data?.manual_meeting_url??null),effectiveMeetingUrl:historical?null:(data?.manual_meeting_url??data?.provider_meeting_url??null),providerSyncStatus:data?.provider_sync_status??'pending',providerSyncError:data?.provider_sync_error?humanizeProviderError('zoom',data.provider_sync_error):null,calendarSyncStatus:data?.sync_status??'pending',calendarSyncError:data?.sync_error?humanizeProviderError('calendar',data.sync_error):null,recordingStatus:data?.recording_status??'expected',recordingError:data?.recording_error?humanizeProviderError('recording',data.recording_error):null}
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){if(!await requireAdmin())return NextResponse.json({error:'Forbidden'},{status:403});const{id}=await params;try{return NextResponse.json(await state(id))}catch(error){console.error('Admin Intensive meeting state failed',{sessionId:id,error});return NextResponse.json({error:'Status meeting belum dapat dimuat.'},{status:400})}}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){const account=await requireAdmin();if(!account)return NextResponse.json({error:'Forbidden'},{status:403});const{id}=await params;try{const current=await state(id);if(current.status==='completed'||current.status==='cancelled')return NextResponse.json({error:'Sesi historis tidak dapat mengubah meeting link aktif.'},{status:409});const body=await request.json() as{url?:unknown};if(body.url!==null&&typeof body.url!=='string')return NextResponse.json({error:'Meeting URL tidak valid.'},{status:400});await setIntensiveManualMeetingUrl(id,body.url as string|null);await syncIntensiveMentoringSession(id,account.user.id);return NextResponse.json(await state(id))}catch(error){console.error('Admin Intensive meeting override failed',{sessionId:id,error});return NextResponse.json({error:humanizeProviderError('meeting',error)},{status:400})}}
