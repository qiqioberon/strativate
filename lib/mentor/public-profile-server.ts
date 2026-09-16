import 'server-only'

import {
  emptyMentorPublicProfileData,
  type MentorExpertiseOption,
  type MentorPublicAchievementView,
  type MentorPublicProfileView,
  type MyMentorPublicProfileData,
} from '@/lib/mentor/public-profile-types'
import { createClient } from '@/lib/supabase/server'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizePayload(value: unknown): MyMentorPublicProfileData {
  if (!isRecord(value)) return emptyMentorPublicProfileData
  return {
    profile: isRecord(value.profile) ? value.profile as MentorPublicProfileView : null,
    achievements: Array.isArray(value.achievements) ? value.achievements as MentorPublicAchievementView[] : [],
    expertise_ids: Array.isArray(value.expertise_ids) ? value.expertise_ids.filter((item): item is string => typeof item === 'string') : [],
    expertise_options: Array.isArray(value.expertise_options) ? value.expertise_options as MentorExpertiseOption[] : [],
  }
}

export type MentorPublicProfileLoadResult = {
  data: MyMentorPublicProfileData
  error: string | null
}

export async function loadMyMentorPublicProfile(): Promise<MentorPublicProfileLoadResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_mentor_public_profile')

  if (error) {
    return {
      data: emptyMentorPublicProfileData,
      error: 'Profil publik mentor belum dapat dimuat. Informasi akun dan operasional tetap aman.',
    }
  }

  return { data: normalizePayload(data), error: null }
}
