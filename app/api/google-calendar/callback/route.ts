import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth/server'
import { completeGoogleCalendarOAuth, googleCalendarOAuthReturnPath } from '@/lib/google-calendar/server'

function calendarReturnPath(role: 'admin' | 'mentor' | 'mentee') {
  if (role === 'admin') return '/admin'
  if (role === 'mentor') return '/mentor/dashboard'
  return '/dashboard'
}

export async function GET(request: Request) {
  const account = await requireAccount()
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    const requested = await googleCalendarOAuthReturnPath(account.user.id, state)
    const target = new URL(requested || calendarReturnPath(account.profile.role), url.origin)
    target.searchParams.set('calendar', 'denied')
    target.searchParams.set('reason', oauthError)
    return NextResponse.redirect(target)
  }
  if (!state || !code) return NextResponse.json({ error: 'Google OAuth callback tidak lengkap.' }, { status: 400 })

  try {
    const returnPath = await completeGoogleCalendarOAuth(account.user.id, state, code)
    const target = new URL(returnPath, url.origin)
    target.searchParams.set('calendar', 'connected')
    return NextResponse.redirect(target)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Google OAuth callback gagal.' }, { status: 400 })
  }
}
