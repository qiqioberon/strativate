import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  AUTH_PERSISTENCE_COOKIE,
  applyAuthCookiePersistence,
  authPersistenceModeFromCookieValue,
} from '@/lib/auth/session-persistence'
import type { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        const mode = authPersistenceModeFromCookieValue(cookieStore.get(AUTH_PERSISTENCE_COOKIE)?.value)
        try { applyAuthCookiePersistence(values, mode).forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
        catch { /* Server Components cannot write cookies; proxy refreshes them. */ }
      },
    },
  })
}
