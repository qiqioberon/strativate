import 'server-only'

import { createClient } from '@/lib/supabase/server'

import {
  ABOUT_US_STORY_IMAGE_BUCKET,
  ABOUT_US_STORY_MEDIA_ID,
} from './about-us-story-config'

export type AboutUsStoryMediaView = {
  imageUrl: string
  altText: string
}

export async function getAboutUsStoryMedia(): Promise<AboutUsStoryMediaView | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('about_us_story_media')
    .select('image_path,alt_text')
    .eq('id', ABOUT_US_STORY_MEDIA_ID)
    .maybeSingle()

  if (error) {
    console.warn('About Us story media is unavailable.', { code: error.code })
    return null
  }
  if (!data?.image_path || !data.alt_text?.trim()) return null
  return {
    imageUrl: supabase.storage.from(ABOUT_US_STORY_IMAGE_BUCKET).getPublicUrl(data.image_path).data.publicUrl,
    altText: data.alt_text.trim(),
  }
}
