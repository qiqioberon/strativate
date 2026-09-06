import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error('Server authentication configuration is missing.')
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, { auth: { autoRefreshToken: false, persistSession: false } })
}
