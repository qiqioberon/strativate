import type { Institution, MasterOption, MenteeProfile, Profile } from '@/lib/supabase/database.types'

export type CanonicalStep = 1 | 2 | 3 | 4
export type VisualStage =
  | 'welcome'
  | 'name-confirmation'
  | 'name-edit'
  | 'username'
  | 'password'
  | 'institution'
  | 'major'
  | 'cohort'
  | 'referral'
  | 'interests'

export type TransitionPhase = 'idle' | 'exit' | 'enter'

export type OnboardingExperienceProps = {
  profile: Profile
  mentee: MenteeProfile
  names: { firstName: string; lastName: string }
  referrals: MasterOption[]
  interests: MasterOption[]
  initialInterests: string[]
  initialInstitution: Institution | null
}

export function canonicalStep(value: number): CanonicalStep {
  if (value <= 1) return 1
  if (value === 2) return 2
  if (value === 3) return 3
  return 4
}

export function initialVisualStage(step: CanonicalStep): VisualStage {
  if (step === 1) return 'welcome'
  if (step === 2) return 'institution'
  if (step === 3) return 'referral'
  return 'interests'
}

const visualProgress: Record<VisualStage, number> = {
  welcome: 0,
  'name-confirmation': 1,
  'name-edit': 1,
  username: 2,
  password: 3,
  institution: 4,
  major: 5,
  cohort: 6,
  referral: 7,
  interests: 8,
}

export function progressForStage(stage: VisualStage) {
  return visualProgress[stage]
}
