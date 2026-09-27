import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { HomepageWhoWeArePhoto } from '@/lib/supabase/database.types'

import { WHO_WE_ARE_PHOTO_BUCKET, WHO_WE_ARE_PHOTO_ROLES } from './who-we-are-photo-config'

export type HomepageWhoWeArePhotoView = Pick<HomepageWhoWeArePhoto, 'role' | 'badge_text'> & {
  alt_text: string
  imageUrl: string
}

export async function listHomepageWhoWeArePhotos(): Promise<HomepageWhoWeArePhotoView[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('homepage_who_we_are_photos')
    .select('role,image_path,alt_text,badge_text')
    .not('image_path', 'is', null)
    .not('alt_text', 'is', null)

  if (error) {
    console.warn('Homepage Who We Are photos are unavailable.', { code: error.code })
    return []
  }

  const byRole = new Map((data ?? []).map(photo => [photo.role, photo]))
  return WHO_WE_ARE_PHOTO_ROLES.map(role => byRole.get(role))
    .filter((photo): photo is NonNullable<typeof photo> & { image_path: string; alt_text: string } => (
      Boolean(photo?.image_path && photo.alt_text)
    ))
    .map(photo => ({
      role: photo.role,
      alt_text: photo.alt_text,
      badge_text: photo.badge_text?.trim() || null,
      imageUrl: supabase.storage.from(WHO_WE_ARE_PHOTO_BUCKET).getPublicUrl(photo.image_path).data.publicUrl,
    }))
}
