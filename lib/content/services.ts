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
    description: 'Informasi Private Mentoring dimuat dari data program aktif.',
    icon: UsersRound,
    href: '/program/private-mentoring',
    detailLabel: 'Lihat Private Mentoring',
  },
  {
    id: 'intensive-mentoring',
    name: 'Intensive Mentoring',
    description: 'Pendampingan rutin dan terstruktur untuk mempersiapkan kompetisi bisnis dari tahap awal hingga final.',
    icon: Trophy,
    href: '/program/intensive-mentoring',
    detailLabel: 'Lihat Intensive Mentoring',
  },
  {
    id: 'big-class',
    name: 'Big Class',
    description: 'Kelas terbuka untuk mempelajari topik bisnis, akuntansi, riset, dan persiapan kompetisi bersama mentor Strativate.',
    icon: Presentation,
  },
  {
    id: 'consultation',
    name: 'Consultation',
    description: 'Sesi untuk mengajukan pertanyaan, memvalidasi ide, dan memperoleh arahan langsung dari mentor.',
    icon: CircleHelp,
  },
  {
    id: 'mock-competition',
    name: 'Mock Competition',
    description: 'Simulasi kompetisi yang mencakup presentasi, penjurian, serta umpan balik untuk meningkatkan kesiapan tim.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'proposal-review-and-feedback',
    name: 'Proposal Review and Feedback',
    description: 'Peninjauan struktur, logika, data, dan penyajian proposal sebelum dikumpulkan.',
    icon: FileSearch,
  },
  {
    id: 'workshop',
    name: 'Workshop',
    description: 'Pelatihan bisnis dan kompetisi untuk sekolah, organisasi, dan komunitas dengan materi yang dapat disesuaikan.',
    icon: Wrench,
  },
  {
    id: 'community',
    name: 'Community',
    description: 'Ruang untuk mendapatkan informasi, peluang belajar, dan kabar kompetisi bersama komunitas Strativate.',
    icon: BookOpenCheck,
  },
]
