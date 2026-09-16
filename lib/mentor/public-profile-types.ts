import type { AssetKey } from '@/lib/content/asset-registry'

export type PublicMentorPhotoStatus = 'ready' | 'missing'

export type PublicMentor = {
  slug: string
  name: string
  tier: string | null
  title?: string
  shortBio?: string
  credentials: string[]
  expertise: string[]
  linkedIn?: string
  portrait: AssetKey | null
  portraitUrl: string | null
  photoStatus: PublicMentorPhotoStatus
}

export type MentorPublicProfileView = {
  id: string
  public_slug: string
  display_name: string
  tier_id: string | null
  tier_name: string | null
  headline: string | null
  linkedin_url: string | null
  short_bio: string | null
  portrait_asset_key: string | null
  portrait_url: string | null
  photo_status: PublicMentorPhotoStatus
  publication_status: 'draft' | 'published'
  sort_order: number
}

export type MentorPublicAchievementView = {
  id: string
  achievement: string
  sort_order: number
}

export type MentorExpertiseOption = {
  id: string
  name: string
  slug: string
  sort_order: number
  is_active: boolean
  assigned: boolean
}

export type MyMentorPublicProfileData = {
  profile: MentorPublicProfileView | null
  achievements: MentorPublicAchievementView[]
  expertise_ids: string[]
  expertise_options: MentorExpertiseOption[]
}

export const emptyMentorPublicProfileData: MyMentorPublicProfileData = {
  profile: null,
  achievements: [],
  expertise_ids: [],
  expertise_options: [],
}
