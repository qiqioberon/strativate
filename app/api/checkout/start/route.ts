import { NextResponse } from 'next/server'

import { getAccount } from '@/lib/auth/server'
import { startOwnedOrderPayment } from '@/lib/payments/application'

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
  if (!account.user.email) return NextResponse.json({ error: 'Account email is required.' }, { status: 400 })

  try {
    const checkout = await startOwnedOrderPayment(orderId, {
      email: account.user.email,
      ...(account.profile.first_name ? { firstName: account.profile.first_name } : {}),
      ...(account.profile.last_name ? { lastName: account.profile.last_name } : {}),
    })
    return NextResponse.json(checkout)
  } catch {
    return NextResponse.json({ error: 'Checkout belum dapat dimulai. Coba lagi.' }, { status: 409 })
  }
}
