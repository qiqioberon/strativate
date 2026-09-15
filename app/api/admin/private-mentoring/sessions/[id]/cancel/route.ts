import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth/server'
import { cancelAdminPrivateMentoringSession } from '@/lib/private-mentoring/scheduling-server'

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
  const account=await requireAccount()
  if(account.profile.role!=='admin') return NextResponse.json({error:'Forbidden'},{status:403})
  const {id}=await params
  try {
    return NextResponse.json(await cancelAdminPrivateMentoringSession(id,account.user.id))
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Sesi belum dapat dibatalkan.'},{status:409})
  }
}
