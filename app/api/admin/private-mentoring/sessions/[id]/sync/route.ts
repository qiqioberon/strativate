import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth/server'
import { syncPrivateMentoringSession } from '@/lib/google-calendar/server'
import { reconcileZoomMeeting } from '@/lib/zoom/server'
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){const account=await requireAccount();if(account.profile.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});const {id}=await params;try{const zoom=await reconcileZoomMeeting(id);if(zoom.status==='failed')return NextResponse.json({status:'provider_failed',zoom,error:zoom.error},{status:409});if(zoom.status==='pending')return NextResponse.json({status:'provider_pending',zoom},{status:202});const calendar=await syncPrivateMentoringSession(id,account.user.id);return NextResponse.json({...calendar,zoom})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Sinkronisasi Google gagal.'},{status:400})}}
