import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveMentoringSlug } from '@/lib/program-routes'
export async function proxy(request: NextRequest) {
  // These programs are informational. Even old checkout links should lead to
  // their public guide, before the authentication guard or demo order UI.
  const checkout = /^\/checkout\/([^/]+)\/?$/.exec(request.nextUrl.pathname)
  const informationSlug = checkout && resolveMentoringSlug(checkout[1])
  if (informationSlug) return NextResponse.redirect(new URL(`/program/${informationSlug}`, request.url))
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
  const protectedPath = /^\/(admin|dashboard|onboarding|checkout)(\/|$)/.test(request.nextUrl.pathname)
    || /^\/mentor\/dashboard(\/|$)/.test(request.nextUrl.pathname)
  if (!user && protectedPath) {
    const redirect = NextResponse.redirect(new URL('/auth', request.url))
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
    return redirect
  }
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
export const config = { matcher: ['/auth/:path*', '/admin/:path*', '/mentor/dashboard/:path*', '/dashboard/:path*', '/onboarding/:path*', '/checkout/:path*'] }
