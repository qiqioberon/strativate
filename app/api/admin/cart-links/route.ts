import { NextResponse } from 'next/server'

import { requireAccount } from '@/lib/auth/server'
import { createAdminCartLink } from '@/lib/private-mentoring/cart-links'

export async function POST(request: Request) {
  const account = await requireAccount()
  if (account.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json() as { menteeId?: unknown; commerceItemIds?: unknown; privateConfig?: unknown }
    if (typeof body.menteeId !== 'string' || !Array.isArray(body.commerceItemIds) || !body.commerceItemIds.every(item => typeof item === 'string')) {
      return NextResponse.json({ error: 'Invalid mentee or Cart Link items.' }, { status: 400 })
    }
    const config=body.privateConfig as {mode?:unknown;mentorTierId?:unknown;targetEnrollmentId?:unknown;sessionCount?:unknown;competitionCategoryId?:unknown;competitionNames?:unknown}|null|undefined
    if(config&&(config.mode!=='new_enrollment'&&config.mode!=='top_up'||typeof config.mentorTierId!=='string'||typeof config.sessionCount!=='number'||config.sessionCount<1||config.sessionCount>20||!Number.isInteger(config.sessionCount)||!Array.isArray(config.competitionNames)||!config.competitionNames.every(value=>typeof value==='string'))){
      return NextResponse.json({error:'Invalid Private Mentoring configuration.'},{status:400})
    }
    if(config?.mode==='top_up'&&typeof config.targetEnrollmentId!=='string')return NextResponse.json({error:'Select an enrollment for the top-up.'},{status:400})
    const created = await createAdminCartLink(body.menteeId, body.commerceItemIds, new URL(request.url).origin, config ? {
      mode:config.mode as 'new_enrollment'|'top_up',mentorTierId:config.mentorTierId as string,targetEnrollmentId:typeof config.targetEnrollmentId==='string'?config.targetEnrollmentId:null,
      sessionCount:config.sessionCount as number,competitionCategoryId:typeof config.competitionCategoryId==='string'?config.competitionCategoryId:null,competitionNames:config.competitionNames as string[],
    }:null)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? 'Invalid Cart Link request.' : error instanceof Error ? error.message : 'Unable to create the Cart Link.' }, { status: 400 })
  }
}
