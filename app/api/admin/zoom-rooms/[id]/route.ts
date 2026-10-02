import {NextResponse} from 'next/server'

import {requireAccount} from '@/lib/auth/server'
import {createClient} from '@/lib/supabase/server'

type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
 const account=await requireAccount();if(account.profile.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403})
 const{id}=await params,supabase=await createClient()
 const{error}=await(supabase as unknown as RpcClient).rpc('admin_delete_mentoring_zoom_room',{p_id:id})
 if(error)return NextResponse.json({error:error.message},{status:409})
 return NextResponse.json({deleted:true})
}
