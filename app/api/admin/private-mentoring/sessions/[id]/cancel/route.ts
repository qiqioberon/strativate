import { adminFormError } from '@/lib/auth/errors'
import { NextResponse } from 'next/server'

import { requireAccount } from '@/lib/auth/server'
import { cancelAdminPrivateMentoringSession } from '@/lib/private-mentoring/scheduling-server'

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
  const account=await requireAccount()
  if(account.profile.role!=='admin') return NextResponse.json({error:'Forbidden'},{status:403})
  const {id}=await params
  try {
    const result=await cancelAdminPrivateMentoringSession(id,account.user.id)
    return NextResponse.json({
      session:result.session,
      sync:{
        status:result.sync.status,
        error:'error' in result.sync&&result.sync.error?adminFormError({message:result.sync.error},'The session was cancelled, but Google Calendar could not be synced.'):undefined,
      },
    })
  } catch(error) {
    console.error('Admin mentoring cancellation failed',{sessionId:id,error})
    return NextResponse.json({error:'Unable to cancel the session. Please try again shortly.'},{status:409})
  }
}
