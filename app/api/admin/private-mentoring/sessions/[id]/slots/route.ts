import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth/server'
import { getAdminBookableSlots } from '@/lib/private-mentoring/scheduling-server'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const account=await requireAccount();if(account.profile.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});const {id}=await params;try{return NextResponse.json(await getAdminBookableSlots(id))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Slot belum dapat dimuat.'},{status:400})}}
