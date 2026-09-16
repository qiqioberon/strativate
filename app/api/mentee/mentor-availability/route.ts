import { NextResponse } from 'next/server'

import { requireAccount } from '@/lib/auth/server'
import { getMenteeMentorAvailability } from '@/lib/private-mentoring/mentee-availability-server'

export const dynamic = 'force-dynamic'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const account = await requireAccount()
  if (account.profile.role !== 'mentee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const mentorId = url.searchParams.get('mentorId')?.trim() || undefined
  const date = url.searchParams.get('date')?.trim() || ''
  if (mentorId && !uuidPattern.test(mentorId)) return NextResponse.json({ error: 'Mentor tidak valid.' }, { status: 400 })
  if (date && !datePattern.test(date)) return NextResponse.json({ error: 'Tanggal tidak valid.' }, { status: 400 })

  try {
    const payload = await getMenteeMentorAvailability({ mentorId, date: date || undefined })
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Ketersediaan mentor belum dapat dimuat.',
    }, { status: 500, headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  }
}
