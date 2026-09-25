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
    description: 'Flexible mentoring for individuals or small teams, tailored to your goals, needs, and timeline.',
    icon: UsersRound,
    href: '/program/private-mentoring',
    detailLabel: 'View Private Mentoring',
  },
  {
    id: 'intensive-mentoring',
    name: 'Intensive Mentoring',
    description: 'Structured, ongoing guidance to prepare for business competitions from first draft to final presentation.',
    icon: Trophy,
    href: '/program/intensive-mentoring',
    detailLabel: 'View Intensive Mentoring',
  },
  {
    id: 'big-class',
    name: 'Big Class',
    description: 'Open classes covering business, accounting, research, and competition preparation with Strativate mentors.',
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
