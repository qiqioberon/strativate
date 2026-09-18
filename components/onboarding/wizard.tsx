'use client'

import type { OnboardingExperienceProps } from './types'
import { OnboardingExperience } from './experience'

export function OnboardingWizard(props: OnboardingExperienceProps) {
  return <OnboardingExperience {...props} />
}
