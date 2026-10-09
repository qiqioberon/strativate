import type { ManagedMentor } from '@/lib/supabase/database.types'

export function managedMentorName(mentor: ManagedMentor) {
  return [mentor.first_name, mentor.last_name].filter(Boolean).join(' ')
    || mentor.username
    || mentor.email
    || 'Mentor account'
}

export function managedMentorTier(mentor: Pick<ManagedMentor, 'tier_name'>) {
  return mentor.tier_name || 'Tier not assigned'
}

export function managedMentorAccountStatus(mentor: Pick<ManagedMentor, 'is_active'>): {
  label: string
  tone: 'active' | 'inactive'
} {
  return mentor.is_active
    ? { label: 'Active', tone: 'active' }
    : { label: 'Inactive', tone: 'inactive' }
}

export function managedMentorSetup(mentor: Pick<ManagedMentor, 'mentor_setup_completed_at'>): {
  label: string
  tone: 'active' | 'pending'
} {
  return mentor.mentor_setup_completed_at
    ? { label: 'Completed', tone: 'active' }
    : { label: 'Not completed', tone: 'pending' }
}

export function managedMentorAvailability(
  mentor: Pick<ManagedMentor, 'availability_current_week_configured' | 'availability_next_week_configured'>,
) {
  if (mentor.availability_current_week_configured && mentor.availability_next_week_configured) return 'This week & next week'
  if (mentor.availability_current_week_configured) return 'This week'
  if (mentor.availability_next_week_configured) return 'Next week'
  return 'Not configured'
}
