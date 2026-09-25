import type { LucideIcon } from 'lucide-react'
import { BookOpenCheck, BriefcaseBusiness, CircleHelp, FileSearch, Presentation, Trophy, UsersRound, Wrench } from 'lucide-react'

export type ServiceOverview = {
  id: string
  name: string
  description: string
  icon: LucideIcon
  href?: string
  detailLabel?: string
}

export const services: ServiceOverview[] = [
  {
    id: 'private-mentoring',
    name: 'Private Mentoring',
    description: 'Get personalized guidance tailored to your goals, whether you’re learning the basics or preparing for a competition.',
    icon: UsersRound,
    href: '/program/private-mentoring',
    detailLabel: 'View Private Mentoring',
  },
  {
    id: 'intensive-mentoring',
    name: 'Intensive Mentoring',
    description: 'Build your skills through structured, ongoing support and focused competition preparation.',
    icon: Trophy,
    href: '/program/intensive-mentoring',
    detailLabel: 'View Intensive Mentoring',
  },
  {
    id: 'big-class',
    name: 'Big Class',
    description: 'Learn business, accounting, and competition skills in engaging group sessions with Strativate mentors.',
    icon: Presentation,
  },
  {
    id: 'consultation',
    name: 'Consultation',
    description: 'Focused sessions to ask questions, validate ideas, and get direct guidance from a mentor.',
    icon: CircleHelp,
  },
  {
    id: 'mock-competition',
    name: 'Mock Competition',
    description: 'Competition simulations with presentations, judging, and feedback to strengthen team readiness.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'proposal-review-and-feedback',
    name: 'Proposal Review and Feedback',
    description: 'Review the structure, logic, data, and presentation of a proposal before submission.',
    icon: FileSearch,
  },
  {
    id: 'workshop',
    name: 'Workshop',
    description: 'Customizable business and competition training for schools, organizations, and communities.',
    icon: Wrench,
  },
  {
    id: 'community',
    name: 'Community',
    description: 'A space for learning opportunities, competition updates, and practical support from the Strativate community.',
    icon: BookOpenCheck,
  },
]
