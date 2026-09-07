import type { MentoringSlug } from './program-routes'

// Editorial source: the two English Strativate guidebooks, supplied 7 Sep 2026.
// Private Top Student 3-session total corrected by the owner to Rp855.000.
export const formatRupiah = (amount: number) => `Rp${new Intl.NumberFormat('id-ID').format(amount)}`

const sessionCounts = [1, 3, 5, 7, 10]
export const privateMentorTiers = [
  { name: 'Top Student Mentor', description: 'High-achieving students sharing strategies from recent, firsthand competition experience.', rates: [300000, 285000, 279000, 270000, 250000] },
  { name: 'Young Professional Mentor', description: 'Industry professionals bringing practical business experience and real-world perspectives.', rates: [350000, 335000, 329000, 320000, 300000] },
].map(tier => ({
  name: tier.name,
  description: tier.description,
  packages: sessionCounts.map((sessions, index) => ({ sessions, perSession: tier.rates[index], total: sessions * tier.rates[index] })),
}))

export const intensivePackages = [
  { name: 'Intensive', sessions: 4, price: 1150000, normalPrice: 1400000, description: 'Consistent weekly guidance, with time to apply feedback between sessions.', features: ['Weekly progress', 'Regular review and refinement', 'Steady competition preparation'] },
  { name: 'Super Intensive', sessions: 8, price: 2200000, normalPrice: 2800000, description: 'More frequent reviews for faster development and tighter preparation timelines.', features: ['Twice-weekly mentoring', 'Faster review cycles', 'Intensive competition preparation'] },
]

export const intensiveAddOns = [
  { name: 'Detailed Performance Report', price: 150000, description: 'A structured evaluation of skills, progress, and development priorities.', features: ['Skill-based scoring', 'Strengths and improvement areas', 'Progress summary', 'Mentor recommendations'] },
  { name: 'Mock Judging Simulation', price: 300000, description: 'Practice your pitch and Q&A in a realistic competition setting with an independent judge.', features: ['Timed pitch simulation', 'Competition-style Q&A', 'Independent judge feedback', 'Rubric-based performance score'] },
  { name: 'Win Guarantee Protection', price: 500000, description: 'Additional protection for eligible participants against an agreed competition milestone.', features: ['Agreed outcome milestone', 'Competition-specific eligibility review', 'Refund or program-credit protection', 'Priority progress monitoring'], conditional: true },
]

export const intensiveBundles = [
  { name: 'Team Starter Bundle', price: 1250000, description: 'For individuals building their skills and working toward forming a suitable competition team.', features: ['Intensive package', 'Detailed Performance Report', 'Personalized mentoring roadmap', 'Competition preparation support'] },
  { name: 'Competition Ready Bundle', price: 2500000, description: 'For intensive preparation, a stronger deck, and realistic pitching practice.', features: ['Super Intensive package', 'Detailed Performance Report', 'Mock Judging Simulation', 'Final-stage preparation support'] },
  { name: 'Competition Assurance Bundle', price: 3000000, description: 'For eligible participants pursuing a defined competition milestone with added protection.', features: ['Super Intensive package', 'Detailed Performance Report', 'Mock Judging Simulation', 'Win Guarantee Protection'], conditional: true },
]

export const guaranteeConditions = 'Terms, conditions, and eligibility assessment apply. The milestone and protection are agreed after a competition-specific review.'

export const competitionCategories = [
  'Business Plan', 'Business Case', 'Business Essay', 'Equity Research',
  'Scientific Paper (Karya Tulis Ilmiah)', 'Marketing', 'Accounting and Finance',
  'Pitching', 'Economic & Policy Case',
]

export const privateLearningPaths = [
  { title: 'End-to-End Learning', description: 'Start from the fundamentals: understanding competitions, identifying problems, developing ideas, business analysis, proposal writing, and pitching. Recommended for first-timers.' },
  { title: 'Competition-Focused Mentoring', description: 'Prepare for a specific target competition, from early case strategy and proposal development to mock presentations, Q&A drills, and final refinement.' },
]

export const privateTopics = [
  { title: 'Idea & Problem Framing', description: 'Clarify the problem, validate your thinking, and shape a relevant solution.' },
  { title: 'Business Analysis & Case Structuring', description: 'Use frameworks, industry research, and competitor analysis to strengthen your case.' },
  { title: 'Proposal Writing & Storyline', description: 'Build a clear executive summary, logical flow, and a persuasive business proposal.' },
  { title: 'Financial Analysis & Valuation', description: 'Work on financial models, valuation, investment analysis, and the assumptions behind them.' },
  { title: 'Slide Deck & Visual Design', description: 'Improve deck structure, data visualization, and presentation clarity.' },
  { title: 'Pitching & Presentation Skills', description: 'Practice delivery, communication, and responding to questions confidently.' },
]

type ContentItem = { title: string; description: string }
export type ProgramInformation = {
  id: string; slug: MentoringSlug; title: 'Private Mentoring' | 'Intensive Mentoring'
  category: 'Private Mentoring' | 'Intensive Mentoring'; kicker: string
  description: string; detail: string; price: number; priceLabel: string; priceContext: string
  sessions: number; format: string; duration: string; tags: string[]; outcomes: string[]
  facts: string[]; audience: string; highlights: string[]; journey: ContentItem[]
  featured: true; informationOnly: true
}

export const mentoringPrograms: ProgramInformation[] = [
  {
    id: 'private-mentoring', slug: 'private-mentoring', title: 'Private Mentoring', category: 'Private Mentoring',
    kicker: 'Flexible, focused sessions',
    description: 'Targeted guidance for a specific challenge, deliverable, or competition stage. Choose the topic, mentor, and number of sessions that fit your needs.',
    detail: 'Start with one focused session and build from there. Develop your foundations, sharpen a proposal, improve your analysis, or rehearse your pitch with practical feedback tailored to your goals.',
    price: privateMentorTiers[0].packages[0].total,
    priceLabel: `From ${formatRupiah(privateMentorTiers[0].packages[0].total)}`,
    priceContext: '1-session package · same price for 1–4 participants',
    sessions: 1, format: 'Online · 75-minute sessions', duration: 'Flexible scheduling',
    tags: ['Per session', 'Individual or team', 'Competition preparation'], featured: true, informationOnly: true,
    audience: 'For beginners learning from the ground up, individuals or teams preparing for a competition, and participants who need a focused review or practice session.',
    highlights: ['75 minutes per session', 'Individual or team of 1–4', 'Choose your mentor'],
    facts: ['75 minutes per session', 'Individual or team of 1–4 participants', 'Top Student or Young Professional Mentor', 'Packages of 1, 3, 5, 7, or 10 sessions'],
    outcomes: ['Direct mentor networking and practical insights', 'Competition strategy discussion and actionable feedback', 'Judge-level perspectives from mentors with judging experience', 'Sample deck exposure when appropriate', 'Opportunity for mentor group discussion with 5+ sessions', 'Mini practice or dummy cases under agreed arrangements'],
    journey: [
      { title: 'Initial consultation', description: 'Share your goals, progress, materials, and the area where you need support.' },
      { title: 'Mentor match & plan', description: 'Find the right mentor and set a focused agenda for your session.' },
      { title: 'Live mentoring session', description: 'Spend 75 interactive minutes discussing, analyzing, and working through your challenge.' },
      { title: 'Action plan & next steps', description: 'Leave with prioritized actions, useful resources, and suggested next topics when needed.' },
    ],
  },
  {
    id: 'intensive-mentoring', slug: 'intensive-mentoring', title: 'Intensive Mentoring', category: 'Intensive Mentoring',
    kicker: 'Structured, continuous guidance',
    description: 'Prepare systematically with a dedicated mentor, a personalized roadmap, regular feedback, and measurable progress throughout your preparation.',
    detail: 'Build your competition readiness over a connected learning journey. Develop core concepts, apply them through assignments, refine your work, and track your progress with one consistent mentor.',
    price: intensivePackages[0].price, priceLabel: `From ${formatRupiah(intensivePackages[0].price)}`,
    priceContext: 'Intensive package · 4 sessions per month',
    sessions: 4, format: 'Regular weekly mentoring', duration: '4 or 8 sessions per month',
    tags: ['Dedicated mentor', 'Structured roadmap', 'Competition preparation'], featured: true, informationOnly: true,
    audience: 'For high school and university students: beginners, active or experienced competitors, skill builders, and teams seeking consistent support toward a shared goal.',
    highlights: ['4 or 8 sessions per month', 'One dedicated mentor', 'Personalized learning roadmap'],
    facts: ['4 or 8 sessions per month for national competitions', 'One consistent mentor throughout the program', 'Personalized roadmap and guided assignments', 'Customized support for international competitions'],
    outcomes: ['Dedicated mentor and personalized learning roadmap', 'Core concepts and practical frameworks', 'Hands-on assignments to develop real outputs', 'Continuous feedback and refinement', 'Competition recommendations and preparation timeline', 'Templates, sample proposals, and pitch deck references', 'Progress monitoring and final evaluation'],
    journey: [
      { title: 'Initial assessment', description: 'Identify your current strengths, skill gaps, and priorities for improvement.' },
      { title: 'Goal setting', description: 'Define learning objectives, competition targets, and expected outcomes.' },
      { title: 'Guided development', description: 'Learn concepts, frameworks, and approaches with your dedicated mentor.' },
      { title: 'Practice & application', description: 'Apply your learning to assignments, case exercises, or competition deliverables.' },
      { title: 'Review & refinement', description: 'Use feedback to improve your work and strengthen areas that need development.' },
      { title: 'Final evaluation', description: 'Review progress, key improvements, and priorities for continued development.' },
    ],
  },
]

export const getProgramInformation = (slug: string) => mentoringPrograms.find(program => program.slug === slug)
