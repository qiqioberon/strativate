import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { AboutFeaturedStorySlot } from '@/lib/supabase/database.types'

import { ABOUT_FEATURED_STORY_BUCKET } from './about-featured-story-config'

export type AboutFeaturedStoryView = {
  id: string
  slot: AboutFeaturedStorySlot
  title: string
  quote: string
  attribution_name: string
  attribution_organization: string
  achievement_text: string
  primary_image_alt_text: string
  secondary_image_alt_text: string | null
  primaryImageUrl: string
  secondaryImageUrl: string | null
}

export async function listActiveAboutFeaturedStories(): Promise<AboutFeaturedStoryView[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('about_featured_stories')
    .select('id,slot,title,quote,attribution_name,attribution_organization,achievement_text,primary_image_path,primary_image_alt_text,secondary_image_path,secondary_image_alt_text,display_order')
    .eq('is_active', true)
    .order('display_order')

  if (error) {
    console.warn('About Featured Stories are unavailable.', { code: error.code })
    return []
  }

  return (data ?? []).flatMap(story => {
    if (
      !story.title
      || !story.quote
      || !story.attribution_name
      || !story.attribution_organization
      || !story.achievement_text
      || !story.primary_image_path
      || !story.primary_image_alt_text
    ) return []

    if (
      story.slot === 'story_two'
      && (!story.secondary_image_path || !story.secondary_image_alt_text)
    ) return []

    return [{
      id: story.id,
      slot: story.slot,
      title: story.title,
      quote: story.quote,
      attribution_name: story.attribution_name,
      attribution_organization: story.attribution_organization,
      achievement_text: story.achievement_text,
      primary_image_alt_text: story.primary_image_alt_text,
      secondary_image_alt_text: story.secondary_image_alt_text,
      primaryImageUrl: supabase.storage.from(ABOUT_FEATURED_STORY_BUCKET).getPublicUrl(story.primary_image_path).data.publicUrl,
      secondaryImageUrl: story.secondary_image_path
        ? supabase.storage.from(ABOUT_FEATURED_STORY_BUCKET).getPublicUrl(story.secondary_image_path).data.publicUrl
        : null,
    }]
  })
}
