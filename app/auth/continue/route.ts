import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { requireAccount } from '@/lib/auth/server'

const RETURN_COOKIE = 'strativate_cart_link_return'
const RETURN_PATTERN = /^\/cart-link\/[A-Za-z0-9_-]{43}$/

export async function GET(request: Request) {
  const account = await requireAccount()
  const cookieStore = await cookies()
  const returnPath = cookieStore.get(RETURN_COOKIE)?.value

  if (account.destination === '/dashboard' && returnPath && RETURN_PATTERN.test(returnPath)) {
    const response = NextResponse.redirect(new URL(returnPath, request.url))
    response.cookies.delete(RETURN_COOKIE)
    return response
  }

  const response = NextResponse.redirect(new URL(account.destination, request.url))
  if (returnPath) response.cookies.delete(RETURN_COOKIE)
  return response
}
