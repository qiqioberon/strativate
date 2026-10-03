export type CommunityStatItem = {
  label: string
  count: number
}

export type SchoolCommunityStatItem = CommunityStatItem & {
  type: 'sma' | 'smk'
}

export type MenteeCommunityStats = {
  totalMentees: number
  schools: SchoolCommunityStatItem[]
  universities: CommunityStatItem[]
  categories: CommunityStatItem[]
}

export type MenteeCommunityStatsResult = {
  stats: MenteeCommunityStats
  available: boolean
}
