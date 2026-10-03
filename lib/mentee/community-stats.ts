import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type {
  CommunityStatItem,
  MenteeCommunityStats,
  MenteeCommunityStatsResult,
  SchoolCommunityStatItem,
} from './community-stats-types'

const EMPTY_STATS: MenteeCommunityStats = {
  totalMentees: 0,
  schools: [],
  universities: [],
  categories: [],
}

function asCount(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0
}

function parseRows(value: unknown): CommunityStatItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    if (!label) return []
    return [{ label, count: asCount(row.count) }]
  })
}

function parseSchoolRows(value: unknown): SchoolCommunityStatItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    const type = row.type === 'sma' || row.type === 'smk' ? row.type : null
    if (!label || !type) return []
    return [{ label, type, count: asCount(row.count) }]
  })
}

export async function getMenteeCommunityStats(): Promise<MenteeCommunityStatsResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_mentee_community_stats')

  if (error) {
    console.error('Mentee community stats unavailable', error.message)
    return { stats: EMPTY_STATS, available: false }
  }

  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {}

  return {
    available: true,
    stats: {
      totalMentees: asCount(payload.totalMentees),
      schools: parseSchoolRows(payload.schools),
      universities: parseRows(payload.universities),
      categories: parseRows(payload.categories),
    },
  }
}
