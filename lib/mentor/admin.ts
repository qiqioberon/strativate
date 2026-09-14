import type { ManagedMentor } from '@/lib/supabase/database.types'

export function managedMentorName(mentor: ManagedMentor) {
  return [mentor.first_name, mentor.last_name].filter(Boolean).join(' ')
    || mentor.username
    || mentor.email
    || 'Akun mentor'
}

export function managedMentorTier(mentor: Pick<ManagedMentor, 'tier_name'>) {
  return mentor.tier_name || 'Tier belum ditentukan'
}

export function managedMentorAccountStatus(mentor: Pick<ManagedMentor, 'is_active'>): {
  label: string
  tone: 'active' | 'inactive'
} {
  return mentor.is_active
    ? { label: 'Aktif', tone: 'active' }
    : { label: 'Nonaktif', tone: 'inactive' }
}

export function managedMentorSetup(mentor: Pick<ManagedMentor, 'mentor_setup_completed_at'>): {
  label: string
  tone: 'active' | 'pending'
} {
  return mentor.mentor_setup_completed_at
    ? { label: 'Selesai', tone: 'active' }
    : { label: 'Belum selesai', tone: 'pending' }
}

export function managedMentorAvailability(
  mentor: Pick<ManagedMentor, 'availability_current_week_configured' | 'availability_next_week_configured'>,
) {
  if (mentor.availability_current_week_configured && mentor.availability_next_week_configured) return 'Minggu ini & depan'
  if (mentor.availability_current_week_configured) return 'Minggu ini'
  if (mentor.availability_next_week_configured) return 'Minggu depan'
  return 'Belum diatur'
}
