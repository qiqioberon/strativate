import { mentoringPrograms } from './program-information'

export type CatalogItem = {
  id: string
  slug: string
  category: 'Private Mentoring' | 'Intensive Mentoring' | 'Big Class' | 'Digital Products'
  title: string
  kicker: string
  description: string
  detail: string
  price: number
  priceLabel: string
  sessions: number
  format: string
  duration: string
  tags: string[]
  outcomes: string[]
  featured?: boolean
  informationOnly?: boolean
}

export const catalogItems: CatalogItem[] = [
  ...mentoringPrograms,
  { id: 'class-leadership', slug: 'leadership-lab', category: 'Big Class', title: 'Leadership Lab', kicker: 'Cohort learning', description: 'Practice leadership habits live with peers facing the same next step.', detail: 'Learn in a structured group with live sessions, peer exchange, and a practical challenge you can bring back to work.', price: 450000, priceLabel: 'Rp 450K', sessions: 8, format: 'Live online cohort', duration: '8 weeks', tags: ['Leadership', 'Cohort'], outcomes: ['Leadership operating system', 'Peer accountability', 'Practical challenge project'] },
  { id: 'class-career', slug: 'career-launchpad', category: 'Big Class', title: 'Career Launchpad', kicker: 'Cohort learning', description: 'A practical cohort for making your next career move with intention.', detail: 'Build a repeatable career strategy alongside peers navigating the same leap.', price: 550000, priceLabel: 'Rp 550K', sessions: 6, format: 'Live online cohort', duration: '6 weeks', tags: ['Career', 'Cohort'], outcomes: ['Career direction', 'Personal positioning', 'Weekly progress plan'] },
  { id: 'digital-pitch', slug: 'pitch-deck-starter-kit', category: 'Digital Products', title: 'Pitch Deck Starter Kit', kicker: 'Self-paced resource', description: 'Templates and prompts for a clearer, more persuasive pitch.', detail: 'A practical download with editable structure, examples, and prompts to help you move from idea to a confident deck.', price: 79000, priceLabel: 'Rp 79K', sessions: 0, format: 'Digital download', duration: 'Self-paced', tags: ['Template', 'Self-paced'], outcomes: ['Editable pitch structure', 'Storytelling prompts', 'Review checklist'], featured: true },
  { id: 'digital-case', slug: 'case-cracking-playbook', category: 'Digital Products', title: 'Case Cracking Playbook', kicker: 'Self-paced resource', description: 'A practical PDF playbook for sharper case thinking.', detail: 'Use a repeatable framework to structure unfamiliar cases, form a point of view, and communicate your recommendation.', price: 99000, priceLabel: 'Rp 99K', sessions: 0, format: 'Digital download', duration: 'Self-paced', tags: ['Playbook', 'Case'], outcomes: ['Case framework', 'Practice prompts', 'Presentation checklist'] },
]

export const categories = ['All', 'Private Mentoring', 'Intensive Mentoring', 'Big Class', 'Digital Products'] as const
export const getCatalogItem = (slug: string) => catalogItems.find((item) => item.slug === slug)
