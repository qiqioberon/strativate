import type { MentoringSlug } from '@/lib/program-routes'

type ContentItem = { title: string; description: string }

export type ProgramEditorial = {
  slug: MentoringSlug
  title: 'Private Mentoring' | 'Intensive Mentoring'
  shortDescription: string
  kicker: string
  detail: string
  audience: string
  highlights: string[]
  journey: ContentItem[]
  tone: 'orange' | 'red'
  assetKey: 'programs.private.cover' | 'programs.intensive.cover'
}

export const programEditorial: Record<MentoringSlug, ProgramEditorial> = {
  'private-mentoring': {
    slug: 'private-mentoring',
    title: 'Private Mentoring',
    shortDescription: 'Flexible mentoring for individuals or small teams, tailored to your goals, needs, and timeline.',
    kicker: 'Flexible, focused sessions',
    detail: 'Start with one focused session and continue as needed. Strengthen your foundations, sharpen a proposal, improve your analysis, or practice your presentation with practical feedback aligned to your goal.',
    audience: 'For beginners building from the basics, individuals or teams preparing for competitions, and participants who need focused review or practice.',
    highlights: ['Choose your focus', 'Learn with a suitable mentor', 'Individual or team preparation'],
    journey: [
      { title: 'Initial consultation', description: 'Share your goals, current work, materials, and the areas where you need support.' },
      { title: 'Mentor matching and planning', description: 'Find a suitable mentor and set a focused agenda for your session.' },
      { title: 'Live mentoring session', description: 'Use the session to discuss, analyze, and work through your challenge.' },
      { title: 'Action plan and next steps', description: 'Leave with clear priorities, useful resources, and suggested follow-up topics when needed.' },
    ],
    tone: 'orange',
    assetKey: 'programs.private.cover',
  },
  'intensive-mentoring': {
    slug: 'intensive-mentoring',
    title: 'Intensive Mentoring',
    shortDescription: 'Structured, ongoing guidance to prepare for business competitions from first draft to final presentation.',
    kicker: 'Structured, ongoing guidance',
    detail: 'Build competition readiness through a consistent learning process. Master core concepts, apply them through assignments, refine your work, and track your progress with the same mentor.',
    audience: 'For high-school and university students: beginners, active or experienced competitors, skill builders, and teams who need consistent support toward a shared goal.',
    highlights: ['A dedicated mentor', 'A tailored learning plan', 'Continuous competition preparation'],
    journey: [
      { title: 'Initial assessment', description: 'Identify your strengths, growth areas, and development priorities.' },
      { title: 'Goal setting', description: 'Set learning goals, competition targets, and expected outcomes.' },
      { title: 'Guided development', description: 'Learn concepts, frameworks, and approaches with your dedicated mentor.' },
      { title: 'Practice and application', description: 'Apply your learning through assignments, case practice, or competition work.' },
      { title: 'Review and refinement', description: 'Use feedback to improve your work and strengthen the areas that need development.' },
      { title: 'Final evaluation', description: 'Review your progress, key improvements, and next development priorities.' },
    ],
    tone: 'red',
    assetKey: 'programs.intensive.cover',
  },
}

export const mentoringProgramEditorial = Object.values(programEditorial)

export const competitionCategories = [
  'Business Plan', 'Business Case', 'Business Essay', 'Equity Research',
  'Scientific Paper', 'Marketing', 'Accounting & Finance',
  'Pitching', 'Policy Case',
]

export function getProgramEditorialBySlug(slug: string): ProgramEditorial | null {
  return Object.hasOwn(programEditorial, slug)
    ? programEditorial[slug as MentoringSlug]
    : null
}
