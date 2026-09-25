import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Competition, Publication } from '@/lib/supabase/database.types'

export type PublicPublication = Publication & { coverUrl: string | null }
export type PublicCompetition = Competition & { coverUrl: string | null }

function coverUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  return path ? supabase.storage.from('marketing-editorial').getPublicUrl(path).data.publicUrl : null
}

export async function listPublishedPublications(): Promise<PublicPublication[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('publications').select('*').eq('is_published', true).order('is_featured', { ascending: false }).order('sort_order').order('published_at', { ascending: false, nullsFirst: false })
  if (error) {
    console.warn('Publications are unavailable.', { code: error.code })
    return []
  }
  return (data ?? []).map(item => ({ ...item, coverUrl: coverUrl(supabase, item.cover_path) }))
}

export async function listPublishedCompetitions(): Promise<PublicCompetition[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('competitions').select('*').eq('is_published', true).order('is_featured', { ascending: false }).order('sort_order').order('registration_deadline', { ascending: true, nullsFirst: false })
  if (error) {
    console.warn('Competitions are unavailable.', { code: error.code })
    return []
  }
  return (data ?? []).map(item => ({ ...item, coverUrl: coverUrl(supabase, item.cover_path) }))
}
