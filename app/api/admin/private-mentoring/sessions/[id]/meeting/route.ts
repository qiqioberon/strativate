import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth/server'
import { setManualMeetingUrl } from '@/lib/google-calendar/server'
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){const account=await requireAccount();if(account.profile.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});const {id}=await params;try{const body=await request.json() as {url?:unknown};if(body.url!==null&&typeof body.url!=='string')return NextResponse.json({error:'Meeting URL tidak valid.'},{status:400});await setManualMeetingUrl(id,body.url as string|null);return NextResponse.json({ok:true})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Meeting link belum dapat diubah.'},{status:400})}}
