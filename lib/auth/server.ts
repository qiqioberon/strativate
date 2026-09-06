import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { destinationFor } from './rules'
export const getAccount = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profileError || !profile) throw new Error('Profil belum dapat dimuat. Coba lagi atau hubungi administrator.')
  const { data: mentee, error: menteeError } = profile.role === 'mentee'
    ? await supabase.from('mentee_profiles').select('*').eq('user_id', user.id).maybeSingle()
    : { data: null, error: null }
  if (menteeError) throw new Error('Progres pendaftaran belum dapat dimuat. Silakan coba lagi.')
  return { user, profile, mentee, destination: destinationFor(profile, mentee) }
})
export async function requireAccount(destination?: string) {
  const account = await getAccount()
  if (!account) redirect('/auth')
  if (destination && account.destination !== destination) redirect(account.destination)
  return account
}
