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
}

export const catalogItems: CatalogItem[] = [
  { id: 'private-brandstorm', slug: 'brandstorm-coaching', category: 'Private Mentoring', title: 'Brandstorm Coaching', kicker: '1:1 mentoring', description: 'Build a sharper competition story with an experienced mentor beside you.', detail: 'A focused private engagement for ambitious competition goals. Move from rough thinking to a story you can defend under pressure.', price: 750000, priceLabel: 'Rp 750K', sessions: 3, format: 'Online · 75 min sessions', duration: '3 weeks', tags: ['Competition', 'Presentation'], outcomes: ['Competition narrative', 'Weekly expert feedback', 'Final pitch rehearsal'], featured: true },
  { id: 'private-portfolio', slug: 'portfolio-direction', category: 'Private Mentoring', title: 'Portfolio Direction', kicker: '1:1 mentoring', description: 'Turn scattered work into a portfolio with a clear professional signal.', detail: 'A guided private sprint to curate your strongest work, explain your process, and prepare for reviews or applications.', price: 900000, priceLabel: 'Rp 900K', sessions: 4, format: 'Online · 60 min sessions', duration: '4 weeks', tags: ['Portfolio', 'Career'], outcomes: ['Portfolio story system', 'Project curation', 'Review-ready presentation'] },
  { id: 'intensive-case', slug: 'business-case-intensive', category: 'Intensive Mentoring', title: 'Business Case Intensive', kicker: 'Fast-track intensive', description: 'Five guided sessions from rough idea to final presentation.', detail: 'A concentrated preparation sprint built around your upcoming case competition, with structured feedback between every milestone.', price: 1200000, priceLabel: 'Rp 1.2M', sessions: 5, format: 'Online · 90 min sessions', duration: '2 weeks', tags: ['Case', 'Fast-track'], outcomes: ['Case structure', 'Solution development', 'Presentation defense'], featured: true },
  { id: 'intensive-interview', slug: 'interview-intensive', category: 'Intensive Mentoring', title: 'Interview Intensive', kicker: 'Fast-track intensive', description: 'A concentrated preparation sprint before the conversation that matters.', detail: 'Work through positioning, practice, and feedback in a compact intensive built around your upcoming interview.', price: 1000000, priceLabel: 'Rp 1M', sessions: 3, format: 'Online · 90 min sessions', duration: '2 weeks', tags: ['Interview', 'Career'], outcomes: ['Interview narrative', 'Mock interview practice', 'Actionable feedback'] },
  { id: 'class-leadership', slug: 'leadership-lab', category: 'Big Class', title: 'Leadership Lab', kicker: 'Cohort learning', description: 'Practice leadership habits live with peers facing the same next step.', detail: 'Learn in a structured group with live sessions, peer exchange, and a practical challenge you can bring back to work.', price: 450000, priceLabel: 'Rp 450K', sessions: 8, format: 'Live online cohort', duration: '8 weeks', tags: ['Leadership', 'Cohort'], outcomes: ['Leadership operating system', 'Peer accountability', 'Practical challenge project'] },
  { id: 'class-career', slug: 'career-launchpad', category: 'Big Class', title: 'Career Launchpad', kicker: 'Cohort learning', description: 'A practical cohort for making your next career move with intention.', detail: 'Build a repeatable career strategy alongside peers navigating the same leap.', price: 550000, priceLabel: 'Rp 550K', sessions: 6, format: 'Live online cohort', duration: '6 weeks', tags: ['Career', 'Cohort'], outcomes: ['Career direction', 'Personal positioning', 'Weekly progress plan'] },
  { id: 'digital-pitch', slug: 'pitch-deck-starter-kit', category: 'Digital Products', title: 'Pitch Deck Starter Kit', kicker: 'Self-paced resource', description: 'Templates and prompts for a clearer, more persuasive pitch.', detail: 'A practical download with editable structure, examples, and prompts to help you move from idea to a confident deck.', price: 79000, priceLabel: 'Rp 79K', sessions: 0, format: 'Digital download', duration: 'Self-paced', tags: ['Template', 'Self-paced'], outcomes: ['Editable pitch structure', 'Storytelling prompts', 'Review checklist'], featured: true },
  { id: 'digital-case', slug: 'case-cracking-playbook', category: 'Digital Products', title: 'Case Cracking Playbook', kicker: 'Self-paced resource', description: 'A practical PDF playbook for sharper case thinking.', detail: 'Use a repeatable framework to structure unfamiliar cases, form a point of view, and communicate your recommendation.', price: 99000, priceLabel: 'Rp 99K', sessions: 0, format: 'Digital download', duration: 'Self-paced', tags: ['Playbook', 'Case'], outcomes: ['Case framework', 'Practice prompts', 'Presentation checklist'] },
]

export const categories = ['All', 'Private Mentoring', 'Intensive Mentoring', 'Big Class', 'Digital Products'] as const
export const getCatalogItem = (slug: string) => catalogItems.find((item) => item.slug === slug)
