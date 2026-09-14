import { NextResponse } from 'next/server'

import { reconcileMidtransWebhook } from '@/lib/payments/application'

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  try {
    const result = await reconcileMidtransWebhook(payload)
    return NextResponse.json({ ok: true, ...result })
  } catch {
    return NextResponse.json({ error: 'Notification rejected.' }, { status: 400 })
  }
}
