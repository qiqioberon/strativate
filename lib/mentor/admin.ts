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

export function managedMentorSetup(mentor: Pick<ManagedMentor, 'mentor_setup_completed_at'>): {
  label: string
  tone: 'active' | 'pending'
} {
  return mentor.mentor_setup_completed_at
    ? { label: 'Aktif', tone: 'active' }
    : { label: 'Menunggu pengaturan akun', tone: 'pending' }
}
