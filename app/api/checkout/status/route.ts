import { NextResponse } from 'next/server'

import { getAccount } from '@/lib/auth/server'
import { reconcileOwnedOrderPayment } from '@/lib/payments/application'

function readOrderId(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const orderId = (value as Record<string, unknown>).orderId
  return typeof orderId === 'string' && orderId.length > 0 ? orderId : null
}

export async function POST(request: Request) {
  const account = await getAccount()
  if (!account) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (account.profile.role !== 'mentee' || !account.mentee?.onboarding_completed_at) {
    return NextResponse.json({ error: 'Completed Mentee account required.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const orderId = readOrderId(body)
  if (!orderId) return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 })

  try {
    return NextResponse.json(await reconcileOwnedOrderPayment(orderId))
  } catch {
    return NextResponse.json({ error: 'Status pembayaran belum dapat diverifikasi.' }, { status: 409 })
  }
}
