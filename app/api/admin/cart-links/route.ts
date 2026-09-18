import { NextResponse } from 'next/server'

import { requireAccount } from '@/lib/auth/server'
import { createAdminCartLink } from '@/lib/private-mentoring/cart-links'

export async function POST(request: Request) {
  const account = await requireAccount()
  if (account.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json() as { menteeId?: unknown; commerceItemIds?: unknown; competitionCategoryId?: unknown; competitionName?: unknown }
    if (typeof body.menteeId !== 'string' || !Array.isArray(body.commerceItemIds) || !body.commerceItemIds.every(item => typeof item === 'string')) {
      return NextResponse.json({ error: 'Mentee dan item Cart Link tidak valid.' }, { status: 400 })
    }
    if (body.competitionCategoryId !== undefined && body.competitionCategoryId !== null && typeof body.competitionCategoryId !== 'string') {
      return NextResponse.json({ error: 'Kategori competition tidak valid.' }, { status: 400 })
    }
    if (body.competitionName !== undefined && body.competitionName !== null && typeof body.competitionName !== 'string') {
      return NextResponse.json({ error: 'Competition / bidang lomba tidak valid.' }, { status: 400 })
    }
    const created = await createAdminCartLink(body.menteeId, body.commerceItemIds, new URL(request.url).origin, {
      categoryId: typeof body.competitionCategoryId === 'string' ? body.competitionCategoryId : null,
      name: typeof body.competitionName === 'string' ? body.competitionName : null,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cart Link belum dapat dibuat.' }, { status: 400 })
  }
}
