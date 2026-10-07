import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { AboutFeaturedStory } from '@/lib/supabase/database.types'

import { ABOUT_FEATURED_STORY_BUCKET } from './about-featured-story-config'

export type AboutFeaturedStoryView = Pick<
  AboutFeaturedStory,
  | 'id'
  | 'title'
  | 'quote'
  | 'attribution_name'
  | 'attribution_organization'
  | 'achievement_text'
  | 'media_layout'
  | 'primary_image_alt_text'
  | 'secondary_image_alt_text'
  | 'display_order'
> & {
  primaryImageUrl: string
  secondaryImageUrl: string | null
}

export async function listActiveAboutFeaturedStories(): Promise<AboutFeaturedStoryView[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('about_featured_stories')
    .select('id,title,quote,attribution_name,attribution_organization,achievement_text,media_layout,primary_image_path,primary_image_alt_text,secondary_image_path,secondary_image_alt_text,display_order,created_at')
    .eq('is_active', true)
    .order('display_order')
    .order('created_at')
    .order('id')

  if (error) {
    console.warn('About Featured Stories are unavailable.', { code: error.code })
    return []
  }

  return (data ?? []).map(story => ({
    id: story.id,
    title: story.title,
    quote: story.quote,
    attribution_name: story.attribution_name,
    attribution_organization: story.attribution_organization,
    achievement_text: story.achievement_text,
    media_layout: story.media_layout,
    primary_image_alt_text: story.primary_image_alt_text,
    secondary_image_alt_text: story.secondary_image_alt_text,
    display_order: story.display_order,
    primaryImageUrl: supabase.storage.from(ABOUT_FEATURED_STORY_BUCKET).getPublicUrl(story.primary_image_path).data.publicUrl,
    secondaryImageUrl: story.secondary_image_path
      ? supabase.storage.from(ABOUT_FEATURED_STORY_BUCKET).getPublicUrl(story.secondary_image_path).data.publicUrl
      : null,
  }))
}
