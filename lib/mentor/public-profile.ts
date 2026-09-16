import 'server-only'

import { assetRegistry, type AssetKey } from '@/lib/content/asset-registry'
import type { PublicMentor } from '@/lib/mentor/public-profile-types'
import { createClient } from '@/lib/supabase/server'
import type { PublicMentorDirectoryRow } from '@/lib/supabase/database.types'

function isAssetKey(value: string | null): value is AssetKey {
  return Boolean(value && value in assetRegistry)
}

function mapPublicMentor(row: PublicMentorDirectoryRow): PublicMentor {
  return {
    slug: row.public_slug,
    name: row.display_name,
    tier: row.tier_name,
    title: row.headline || undefined,
    shortBio: row.short_bio || undefined,
    credentials: row.achievements || [],
    expertise: row.expertise || [],
    linkedIn: row.linkedin_url || undefined,
    portrait: isAssetKey(row.portrait_asset_key) ? row.portrait_asset_key : null,
    portraitUrl: row.portrait_url,
    photoStatus: row.photo_status === 'ready' ? 'ready' : 'missing',
  }
}

export async function listPublishedMentors(): Promise<PublicMentor[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_public_mentors')

  if (error) {
    console.warn('Published mentor directory is unavailable.', { code: error.code })
    return []
  }

  return (data || []).map(mapPublicMentor)
}
