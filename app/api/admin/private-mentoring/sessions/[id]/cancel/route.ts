import { NextResponse } from 'next/server'

import { requireAccount } from '@/lib/auth/server'
import { humanizeProviderError } from '@/lib/operations/provider-errors'
import { cancelAdminPrivateMentoringSession } from '@/lib/private-mentoring/scheduling-server'

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
  const account=await requireAccount()
  if(account.profile.role!=='admin') return NextResponse.json({error:'Forbidden'},{status:403})
  const {id}=await params
  try {
    const result=await cancelAdminPrivateMentoringSession(id,account.user.id)
    return NextResponse.json({
      session:result.session,
      zoom:{
        status:result.zoom.status,
        error:'error' in result.zoom&&result.zoom.error?humanizeProviderError('zoom',result.zoom.error):undefined,
      },
      sync:{
        status:result.sync.status,
        error:'error' in result.sync&&result.sync.error?humanizeProviderError('calendar',result.sync.error):undefined,
      },
    })
  } catch(error) {
    console.error('Admin mentoring cancellation failed',{sessionId:id,error})
    return NextResponse.json({error:'Sesi belum dapat dibatalkan. Coba lagi beberapa saat kemudian.'},{status:409})
  }
}
