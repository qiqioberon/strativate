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
  'Strong partnerships',
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
  {
    category: 'Programs',
    question: 'Which programs are available?',
    answer: 'Explore Private Mentoring, Intensive Mentoring, Big Class, and focused support services on the Programs page.',
    source: 'services',
  },
  {
    category: 'Programs',
    question: 'Which mentoring format should I choose?',
    answer: 'Choose flexible support for a specific goal or structured ongoing preparation for a competition.',
    source: 'services',
  },
  {
    category: 'Programs',
    question: 'Can schools and organizations work with Strativate?',
    answer: 'Yes. Workshops, competition mentoring and judging, and enrichment programs are available for organizations.',
    source: 'services',
  },
  {
    category: 'Mentors',
    question: 'How do I choose a mentor?',
    answer: 'Use the Mentor directory search and filters to explore the expertise and public information available for each mentor.',
    source: 'mentor-directory',
  },
  {
    category: 'Mentors',
    question: 'What appears on a mentor profile?',
    answer: 'Profiles show the public headline, expertise, available credentials, and LinkedIn link when provided.',
    source: 'mentor-directory',
  },
  {
    category: 'Account',
    question: 'How do I create an account?',
    answer: 'Choose Sign in, select the registration option, and follow the verification steps to complete your profile.',
    source: 'auth',
  },
  {
    category: 'Account',
    question: 'How do I sign in?',
    answer: 'Sign in with your email and password or continue with Google from the authentication page.',
    source: 'auth',
  },
  {
    category: 'Support',
    question: 'How can I contact Strativate?',
    answer: `Contact Strativate through WhatsApp at ${publicContact.phone} or email ${publicContact.email}.`,
    source: 'public-contact',
  },
  {
    category: 'Support',
    question: 'What if I am not sure which service I need?',
    answer: 'Share your goals through WhatsApp and the Strativate team can help you choose a suitable next step.',
    source: 'public-contact',
  },
] as const satisfies ReadonlyArray<MarketingFaq>

export const bigClassPlaceholder = {
  title: 'Big Class',
  kicker: 'Open classes',
  description: 'Open classes covering business, accounting, research, and competition preparation.',
  contentStatus: 'overview',
  cover: 'programs.bigClass.cover' as const,
}
