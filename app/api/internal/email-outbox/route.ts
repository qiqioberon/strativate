import { NextResponse } from 'next/server'

import { drainPaidInvoiceOutbox } from '@/lib/email/invoice-delivery'

export const dynamic = 'force-dynamic'

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const result = await drainPaidInvoiceOutbox(20)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Transactional email outbox drain failed.', {
      code: error instanceof Error ? error.message : 'unknown',
    })
    return NextResponse.json({ error: 'Outbox drain failed.' }, { status: 503 })
  }
}
