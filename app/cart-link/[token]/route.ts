import { NextResponse } from 'next/server'

import { getAccount } from '@/lib/auth/server'
import { hashCartLinkToken } from '@/lib/private-mentoring/cart-links'
import { createClient } from '@/lib/supabase/server'

const RETURN_COOKIE = 'strativate_cart_link_return'
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

function redirectWithReturnCookie(request: Request, destination: string, returnPath: string) {
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.cookies.set(RETURN_COOKIE, returnPath, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:',
    path: '/',
    maxAge: 15 * 60,
  })
  return response
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  if (!TOKEN_PATTERN.test(token)) {
    return NextResponse.redirect(new URL('/cart-link/error?reason=invalid', request.url))
  }

  const returnPath = `/cart-link/${token}`
  const account = await getAccount()
  if (!account) return redirectWithReturnCookie(request, '/auth', returnPath)
  if (account.profile.role !== 'mentee') {
    return NextResponse.redirect(new URL('/cart-link/error?reason=not-authorized', request.url))
  }
  if (account.destination !== '/dashboard') {
    return redirectWithReturnCookie(request, account.destination, returnPath)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('claim_commerce_cart_link', { p_token_hash: hashCartLinkToken(token) })
  if (error || !data) {
    const reason = error?.code === '42501' ? 'not-authorized' : 'invalid'
    return NextResponse.redirect(new URL(`/cart-link/error?reason=${reason}`, request.url))
  }

  const response = NextResponse.redirect(new URL('/cart', request.url))
  response.cookies.delete(RETURN_COOKIE)
  return response
}
