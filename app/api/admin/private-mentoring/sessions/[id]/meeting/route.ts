import { NextResponse } from 'next/server'

import { requireAccount } from '@/lib/auth/server'
import { setManualMeetingUrl, syncPrivateMentoringSession } from '@/lib/google-calendar/server'
import { createClient } from '@/lib/supabase/server'

type RpcClient = { rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}> }

async function meetingState(sessionId:string){
  const supabase=await createClient()
  const {data,error}=await (supabase as unknown as RpcClient).rpc('admin_get_mentoring_meeting_state',{p_session_kind:'private',p_session_id:sessionId})
  if(error||!data)throw new Error(error?.message||'Status meeting belum dapat dimuat.')
  return data
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const account=await requireAccount()
  if(account.profile.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403})
  const{id}=await params
  try{return NextResponse.json(await meetingState(id))}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Status meeting belum dapat dimuat.'},{status:400})}
}

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  const account=await requireAccount()
  if(account.profile.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403})
  const{id}=await params
  try{
    const body=await request.json() as{url?:unknown;zoomRoomId?:unknown}
    const changingRoom=typeof body.zoomRoomId==='string'
    const changingUrl=body.url===null||typeof body.url==='string'
    if(changingRoom===changingUrl)return NextResponse.json({error:'Pilih satu perubahan meeting yang valid.'},{status:400})
    const current=await meetingState(id) as{status:string;assignedZoomRoomId:string|null}
    if(current.status==='completed'||current.status==='cancelled')return NextResponse.json({error:'Sesi historis tidak dapat mengubah meeting link aktif.'},{status:409})
    if(changingRoom){
      const supabase=await createClient()
      const result=await (supabase as unknown as RpcClient).rpc('admin_assign_mentoring_zoom_room',{p_session_kind:'private',p_session_id:id,p_zoom_room_id:body.zoomRoomId})
      if(result.error)throw new Error(result.error.message)
    }else{
      if(body.url===null&&!current.assignedZoomRoomId)return NextResponse.json({error:'Sesi legacy belum memiliki Zoom room terkelola. Pilih Zoom room sebelum menghapus link manual.'},{status:409})
      await setManualMeetingUrl(id,body.url as string|null)
    }
    await syncPrivateMentoringSession(id,account.user.id)
    return NextResponse.json(await meetingState(id))
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Meeting sesi belum dapat diperbarui.'},{status:409})}
}
