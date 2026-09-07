export const mentoringSlugs = ['private-mentoring', 'intensive-mentoring'] as const
export type MentoringSlug = (typeof mentoringSlugs)[number]

const legacySlugs: Record<string, MentoringSlug> = {
  'brandstorm-coaching': 'private-mentoring',
  'portfolio-direction': 'private-mentoring',
  'business-case-intensive': 'intensive-mentoring',
  'interview-intensive': 'intensive-mentoring',
}

export function resolveMentoringSlug(slug: string): MentoringSlug | undefined {
  if (slug === 'private-mentoring' || slug === 'intensive-mentoring') return slug
  return Object.hasOwn(legacySlugs, slug) ? legacySlugs[slug] : undefined
}
