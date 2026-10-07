import type { IntensiveProgramStage } from '@/lib/intensive-mentoring/types'

export const menteeIntensiveStageLabels: Record<IntensiveProgramStage, string> = {
  goal_setting: 'Goal setting',
  initial_assessment: 'Initial assessment',
  guided_development: 'Guided development',
  practice_application: 'Practice & application',
  review_refinement: 'Review & refinement',
  final_evaluation: 'Final evaluation',
}

const mentoringNames: Record<string, string> = {
  'Kompetisi Internasional': 'International Competition',
  'Bundel Skill Builder': 'Bundle Skill Builder',
  'Bundel Competition Ready': 'Bundle Competition Ready',
  'Bundel Competition Assurance': 'Bundle Competition Assurance',
  'Laporan Performa Terperinci': 'Detailed Performance Report',
  'Laporan Kinerja Terperinci': 'Detailed Performance Report',
  'Simulasi Penjurian': 'Judging Simulation',
}

// Translate known catalog labels while preserving names and user-entered content.
export function menteeMentoringName(value: string): string {
  return mentoringNames[value] ?? value
}

export function menteeSessionStatus(status: string) {
  switch (status) {
    case 'awaiting_focus': return { label: 'Awaiting admin review', tone: 'warning' }
    case 'awaiting_scheduling': return { label: 'Awaiting scheduling', tone: 'info' }
    case 'scheduled': return { label: 'Scheduled', tone: 'positive' }
    case 'completed': return { label: 'Completed', tone: 'neutral' }
    case 'cancelled': return { label: 'Cancelled', tone: 'neutral' }
    default: return { label: status.replaceAll('_', ' '), tone: 'neutral' }
  }
}

export function menteeReviewStatus(status: string): string {
  if (status === 'confirmed') return 'Reviewed'
  if (status === 'pending_review') return 'Awaiting admin review'
  return 'Not reviewed'
}

export function menteeMentoringError(message: string | undefined, fallback: string): string {
  const value = message?.toLowerCase() ?? ''
  if (/auth|not authenticated|jwt|belum masuk/.test(value)) return 'Your session has expired. Please sign in again.'
  if (/forbidden|permission|access denied|not allowed|tidak diizinkan/.test(value)) return 'You do not have access to update these details.'
  if (/closed|completed|cancelled|sudah selesai|dibatalkan/.test(value)) return 'This session is closed and cannot be edited.'
  if (/upcoming scheduled session/.test(value)) return 'Preferences can only be changed before your session starts.'
  if (/category.*(inactive|not active)|active competition category required|kategori.*tidak aktif/.test(value)) return 'Choose an active competition category.'
  if (/focus.*(inactive|not active)|active focus required|fokus.*tidak aktif/.test(value)) return 'Choose an available session focus.'
  if (/at least one competition name/.test(value)) return 'Add at least one competition name.'
  if (/competition names exceed/.test(value)) return 'Add up to 20 competition names, each under 300 characters.'
  if (/supporting materials exceed/.test(value)) return 'Add up to 20 supporting files, with each link or note under 1,000 characters.'
  if (/custom focus is too long/.test(value)) return 'Keep your session focus under 300 characters.'
  if (/topic is too long/.test(value)) return 'Keep your topic under 3,000 characters.'
  if (/not found|tidak ditemukan/.test(value)) return 'This mentoring record is no longer available. Refresh and try again.'
  return fallback
}
