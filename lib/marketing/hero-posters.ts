import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { MarketingHeroPoster } from '@/lib/supabase/database.types'
import { HERO_POSTER_BUCKET } from '@/lib/marketing/hero-poster-config'

export type MarketingHeroPosterView = Pick<
  MarketingHeroPoster,
  'id' | 'alt_text' | 'title' | 'url' | 'sort_order'
> & {
  imageUrl: string
}

export async function listActiveHeroPosters(): Promise<MarketingHeroPosterView[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marketing_hero_posters')
    .select('id,image_path,alt_text,title,url,sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at')

  if (error) {
    console.warn('Hero posters are unavailable; using the approved brand fallback.', { code: error.code })
    return []
  }

  return (data ?? []).map((poster) => ({
    id: poster.id,
    alt_text: poster.alt_text,
    title: poster.title,
    url: poster.url,
    sort_order: poster.sort_order,
    imageUrl: supabase.storage.from(HERO_POSTER_BUCKET).getPublicUrl(poster.image_path).data.publicUrl,
  }))
}
