import type { AssetKey } from './asset-registry'
import { publicContact } from './brand'

export type NavigationIcon = 'house' | 'compass' | 'users' | 'library' | 'sparkles' | 'help' | 'newspaper' | 'trophy'

export const marketingNavigationItems = [
  { label: 'Home', href: '/', icon: 'house' },
  { label: 'Programs', href: '/program', icon: 'compass' },
  { label: 'Mentors', href: '/mentor', icon: 'users' },
  { label: 'Digital Products', href: '/produk-digital', icon: 'library' },
  { label: 'Publications', href: '/publications', icon: 'newspaper' },
  { label: 'Competitions', href: '/competitions', icon: 'trophy' },
  { label: 'About Us', href: '/tentang-kami', icon: 'sparkles' },
  { label: 'FAQ', href: '/tanya-jawab', icon: 'help' },
] as const satisfies ReadonlyArray<{ label: string; href: string; icon: NavigationIcon }>

export type MarketingNavigationItem =
  (typeof marketingNavigationItems)[number]

export function getMarketingNavigation(digitalProductsEnabled: boolean) {
  return marketingNavigationItems.filter(
    item => digitalProductsEnabled || item.href !== '/produk-digital',
  )
}

export const marketingNavigation = getMarketingNavigation(false)

export const preparationPrinciples = [
  { number: '01', title: 'Future-Ready Skills Mastery', description: 'Build practical skills through focused, structured learning.' },
  { number: '02', title: 'Business & Financial Literacy', description: 'Strengthen business, accounting, and analytical thinking.' },
  { number: '03', title: 'Sustainable Learning Ecosystem', description: 'Keep learning through coaching, practice, and community.' },
] as const

export const homepageExpertise = [
  { title: 'Business Plan', description: 'Crafting viable and scalable business models.' },
  { title: 'Business Case', description: 'Solving real-world corporate challenges.' },
  { title: 'Business Essay', description: 'Articulating critical thoughts on economic issues.' },
  { title: 'Scientific Paper', description: 'Research-based problems and solutions.' },
  { title: 'Marketing', description: 'Strategic approaches to market campaigns.' },
  { title: 'Accounting & Finance', description: 'Mastering numerical and financial analysis.' },
  { title: 'Pitching', description: 'Delivering persuasive and winning presentations.' },
  { title: 'Policy Case', description: 'Analyzing public policy and governance strategies.' },
] as const

export const whyChooseStrativate = [
  'Fast track integrated learning',
  'Expert coaches & mentors',
  'Proven curriculum',
  'Beginner-friendly',
  'Practical skill development',
  'Personalized paths',
] as const

export type ProductPreview = {
  id: string
  contentStatus: 'placeholder'
  cover: AssetKey
  eyebrow: string
  title: string
  description: string
}

export const productPlaceholders: ProductPreview[] = [
  {
    id: 'guide',
    contentStatus: 'placeholder',
    cover: 'products.guide.cover',
    eyebrow: 'Slot produk digital 01',
    title: 'Materi sedang disiapkan',
    description: 'Nama, format, harga, dan sampul akan tampil setelah detail produk final disetujui.',
  },
  {
    id: 'template',
    contentStatus: 'placeholder',
    cover: 'products.template.cover',
    eyebrow: 'Slot produk digital 02',
    title: 'Koleksi siap diganti',
    description: 'Struktur kartu telah siap menerima sampul dan detail produk final tanpa redesain.',
  },
]

export type MarketingFaq = {
  category: 'Programs' | 'Mentors' | 'Account' | 'Support'
  question: string
  answer: string
  source: 'services' | 'mentor-directory' | 'auth' | 'public-contact'
}

export const faqPreview = [
  { category: 'Programs', question: 'Who can join Strativate?', answer: 'Strativate supports students through mentoring and learning programs, and works with schools and organizations through workshops and competition-focused programs.', source: 'services' },
  { category: 'Programs', question: 'Do students need prior business knowledge to start?', answer: 'Programs support different starting points. Share your current goal and preparation stage so you can choose an appropriate format.', source: 'services' },
  { category: 'Programs', question: 'What types of competitions do you support?', answer: 'Strativate covers major business competition areas including business plans, business cases, essays, scientific papers, marketing, accounting and finance, pitching, and policy cases.', source: 'services' },
  { category: 'Programs', question: 'What topics do you cover during mentoring?', answer: 'Support can cover business planning, accounting, research, analysis, proposal development, presentation, and competition preparation depending on the chosen program.', source: 'services' },
  { category: 'Programs', question: 'Is Strativate for individuals or teams?', answer: 'Private Mentoring supports individuals and small teams. Other services may use different formats, so check the relevant program information before starting.', source: 'services' },
  { category: 'Programs', question: 'How does private mentoring at Strativate work?', answer: 'Private Mentoring provides personalized guidance tailored to your goals, whether you are learning the basics or preparing for a competition.', source: 'services' },
  { category: 'Programs', question: 'Can Strativate help with proposal or pitch deck review?', answer: 'Yes. Proposal Review & Feedback is designed to improve structure, logic, data, and presentation before submission.', source: 'services' },
  { category: 'Programs', question: 'Do you provide mock presentations?', answer: 'Yes. Mock Competition provides presentation practice, judging, and feedback to strengthen readiness.', source: 'services' },
  { category: 'Programs', question: 'How many sessions should a student take?', answer: 'Private Mentoring offers different package options. The right session count depends on your goal, timeline, and preparation needs.', source: 'services' },
  { category: 'Mentors', question: 'How do I choose a mentor?', answer: 'Use the Mentor directory search and filters to explore the expertise and public information available for each mentor.', source: 'mentor-directory' },
  { category: 'Account', question: 'How do I create an account?', answer: 'Choose Sign in, select the registration option, and follow the verification steps to complete your profile.', source: 'auth' },
  { category: 'Support', question: 'How can I contact Strativate?', answer: `Contact Strativate through WhatsApp at ${publicContact.phone} or email ${publicContact.email}.`, source: 'public-contact' },
] as const satisfies ReadonlyArray<MarketingFaq>

export const bigClassPlaceholder = {
  title: 'Big Class',
  kicker: 'Open classes',
  description: 'Learn business, accounting, and competition skills in engaging group sessions with Strativate mentors.',
  contentStatus: 'overview',
  cover: 'programs.bigClass.cover' as const,
}
