'use client'
import { createBrowserClient } from '@supabase/ssr'
import {
  applyAuthCookiePersistence,
  readBrowserAuthPersistenceMode,
  readBrowserCookies,
  writeBrowserCookie,
} from '@/lib/auth/session-persistence'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: readBrowserCookies,
        setAll(values) {
          const mode = readBrowserAuthPersistenceMode()
          applyAuthCookiePersistence(values, mode).forEach(writeBrowserCookie)
        },
      },
    },
  )
}
