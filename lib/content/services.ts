import type { LucideIcon } from 'lucide-react'
import { BookOpenCheck, BriefcaseBusiness, CircleHelp, FileSearch, Presentation, Trophy, UsersRound, Wrench } from 'lucide-react'
import type { CatalogProductSummary, CatalogProductType } from '@/lib/catalog/types'

export type ServiceOverview = {
  id: string
  name: string
  description: string
  productType?: Extract<CatalogProductType, 'private_mentoring' | 'intensive_mentoring'>
  icon: LucideIcon
}

export type ConnectedServiceOverview = ServiceOverview & { href?: string; detailLabel?: string }

export const services: ServiceOverview[] = [
  {
    id: 'private-mentoring',
    name: 'Private Mentoring',
    description: 'Mentoring fleksibel untuk individu atau tim kecil yang disesuaikan dengan kebutuhan, target, dan timeline peserta.',
    productType: 'private_mentoring',
    icon: UsersRound,
  },
  {
    id: 'intensive-mentoring',
    name: 'Intensive Mentoring',
    description: 'Pendampingan rutin dan terstruktur untuk mempersiapkan kompetisi bisnis dari tahap awal hingga final.',
    productType: 'intensive_mentoring',
    icon: Trophy,
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

export function connectServicesToCatalog(products: CatalogProductSummary[]): ConnectedServiceOverview[] {
  return services.map((service) => {
    if (!service.productType) return service
    const product = products.find(item => item.productType === service.productType)
    return product ? { ...service, href: `/program/${product.slug}`, detailLabel: `Lihat ${product.title}` } : service
  })
}
