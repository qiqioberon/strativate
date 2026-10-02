import {NextResponse} from 'next/server'

import {requireAccount} from '@/lib/auth/server'
import {createClient} from '@/lib/supabase/server'
import {reconcileManagedZoomRoomCalendars} from '@/lib/zoom-rooms/server'

type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}

async function adminRpc(){
 const account=await requireAccount()
 if(account.profile.role!=='admin')return null
 const supabase=await createClient()
 return{account,rpc:supabase as unknown as RpcClient}
}

export async function GET(){
 const context=await adminRpc();if(!context)return NextResponse.json({error:'Forbidden'},{status:403})
 const{data,error}=await context.rpc.rpc('admin_list_mentoring_zoom_rooms')
 if(error)return NextResponse.json({error:error.message},{status:400})
 return NextResponse.json({rooms:data??[]})
}

export async function POST(request:Request){
 const context=await adminRpc();if(!context)return NextResponse.json({error:'Forbidden'},{status:403})
 try{
  const body=await request.json() as{id?:unknown;name?:unknown;meetingUrl?:unknown;isActive?:unknown;sortOrder?:unknown}
  if((body.id!==undefined&&body.id!==null&&typeof body.id!=='string')||typeof body.name!=='string'||typeof body.meetingUrl!=='string'||typeof body.isActive!=='boolean')return NextResponse.json({error:'Data Zoom room tidak valid.'},{status:400})
  const sortOrder=typeof body.sortOrder==='number'&&Number.isInteger(body.sortOrder)?body.sortOrder:0
  const{data,error}=await context.rpc.rpc<{room:{id:string};urlChanged:boolean}>('admin_upsert_mentoring_zoom_room',{p_id:body.id??null,p_name:body.name,p_meeting_url:body.meetingUrl,p_is_active:body.isActive,p_sort_order:sortOrder})
  if(error||!data)return NextResponse.json({error:error?.message||'Zoom room belum dapat disimpan.'},{status:409})
  let calendarFailures=0
  let calendarWarning:string|null=null
  if(data.urlChanged){
   try{calendarFailures=await reconcileManagedZoomRoomCalendars(data.room.id,context.account.user.id)}
   catch{calendarWarning='Zoom room tersimpan, tetapi sesi terkait belum dapat diperiksa untuk sinkronisasi Calendar.'}
  }
  return NextResponse.json({...data,calendarFailures,calendarWarning})
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Zoom room belum dapat disimpan.'},{status:400})}
}
