import { NextResponse } from 'next/server'

import { requireAccount } from '@/lib/auth/server'
import { syncPrivateMentoringSession } from '@/lib/google-calendar/server'
import { humanizeProviderError } from '@/lib/operations/provider-errors'
import { reconcileZoomMeeting } from '@/lib/zoom/server'

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
  const account=await requireAccount()
  if(account.profile.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403})
  const {id}=await params
  try{
    const zoom=await reconcileZoomMeeting(id)
    if(zoom.status==='failed'){
      console.error('Admin Zoom reconciliation failed',{sessionId:id,error:zoom.error})
      return NextResponse.json({status:'provider_failed',zoom:{status:zoom.status},error:humanizeProviderError('zoom',zoom.error)},{status:409})
    }
    if(zoom.status==='pending')return NextResponse.json({status:'provider_pending',zoom:{status:zoom.status}},{status:202})
    if(zoom.status==='inactive')return NextResponse.json({status:'inactive',zoom:{status:zoom.status}})
    const calendar=await syncPrivateMentoringSession(id,account.user.id)
    return NextResponse.json({
      status:calendar.status,
      error:'error' in calendar&&calendar.error?humanizeProviderError('calendar',calendar.error):undefined,
      zoom:{status:zoom.status},
    })
  }catch(error){
    console.error('Admin Zoom / Calendar sync failed',{sessionId:id,error})
    return NextResponse.json({error:humanizeProviderError('meeting',error)},{status:400})
  }
}
