import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
const emailTypes = new Set(['email', 'magiclink', 'signup', 'invite', 'recovery'])
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code'), token_hash = params.get('token_hash'), type = params.get('type')
  const supabase = await createClient()
  let destination = '/auth/error'
  try {
    if (!params.has('error')) {
      const result = code ? await supabase.auth.exchangeCodeForSession(code)
        : token_hash && type && emailTypes.has(type) ? await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType }) : null
      if (result && !result.error && result.data.user) destination = type === 'recovery' ? '/auth/recovery' : '/auth/continue'
    }
  } catch { /* Expired callback uses a fixed error page. */ }
  // Never consume a browser-provided next/returnTo URL.
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
