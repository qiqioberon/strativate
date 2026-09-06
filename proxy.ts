import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values) {
      values.forEach(({ name, value }) => request.cookies.set(name, value))
      response = NextResponse.next({ request })
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    },
  } })
  const { data: { user } } = await supabase.auth.getUser()
  const protectedPath = /^\/(admin|mentor|dashboard|onboarding|checkout)(\/|$)/.test(request.nextUrl.pathname)
  if (!user && protectedPath) {
    const redirect = NextResponse.redirect(new URL('/auth', request.url))
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
    return redirect
  }
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
export const config = { matcher: ['/auth/:path*', '/admin/:path*', '/mentor/:path*', '/dashboard/:path*', '/onboarding/:path*', '/checkout/:path*'] }
