import type { AssetKey } from './asset-registry'

export type NavigationIcon = 'house' | 'compass' | 'users' | 'library' | 'sparkles' | 'help'

export const marketingNavigation = [
  { label: 'Beranda', href: '/', icon: 'house' },
  { label: 'Program', href: '/program', icon: 'compass' },
  { label: 'Mentor', href: '/mentor', icon: 'users' },
  { label: 'Produk Digital', href: '/produk-digital', icon: 'library' },
  { label: 'Tentang Kami', href: '/tentang-kami', icon: 'sparkles' },
  { label: 'Tanya Jawab', href: '/tanya-jawab', icon: 'help' },
] as const satisfies ReadonlyArray<{ label: string; href: string; icon: NavigationIcon }>

export const preparationPrinciples = [
  { number: '01', title: 'Mulai dari kebutuhanmu', description: 'Pilih dukungan berdasarkan tahap persiapan dan fokus yang sedang kamu kerjakan.' },
  { number: '02', title: 'Susun langkah yang jelas', description: 'Ubah tantangan besar menjadi agenda belajar yang lebih mudah dijalankan.' },
  { number: '03', title: 'Perbaiki dengan terarah', description: 'Gunakan setiap sesi dan materi untuk meninjau, mencoba, lalu menyempurnakan.' },
] as const

export type MentorPreview = {
  id: string
  contentStatus: 'placeholder'
  portrait: AssetKey
  name?: string
  role?: string
  expertise?: string
  university?: string
  achievement?: string
  rating?: number
}

export const mentorPlaceholders: MentorPreview[] = [
  { id: 'primary', contentStatus: 'placeholder', portrait: 'mentors.primary.portrait', expertise: 'Profil dan keahlian sedang diverifikasi' },
  { id: 'secondary', contentStatus: 'placeholder', portrait: 'mentors.secondary.portrait', expertise: 'Profil dan keahlian sedang diverifikasi' },
  { id: 'tertiary', contentStatus: 'placeholder', portrait: 'mentors.tertiary.portrait', expertise: 'Profil dan keahlian sedang diverifikasi' },
]

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
    description: 'Nama, format, harga, dan sampul akan tampil setelah master produk disetujui.',
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

export const faqPreview = [
  {
    question: 'Di mana saya bisa membandingkan program?',
    answer: 'Halaman Program merangkum pilihan yang tersedia dan mengarahkanmu ke informasi setiap program.',
  },
  {
    question: 'Kapan profil mentor ditampilkan?',
    answer: 'Profil akan dipublikasikan setelah identitas, keahlian, foto, dan izin tayang selesai diverifikasi.',
  },
  {
    question: 'Bagaimana jika informasi yang saya cari belum tersedia?',
    answer: 'Informasi yang masih menunggu keputusan Strativate ditandai sebagai belum tersedia agar tidak menimbulkan klaim yang keliru.',
  },
] as const

export const bigClassPlaceholder = {
  title: 'Big Class',
  kicker: 'Program kelompok',
  description: 'Informasi program, jadwal, pengajar, dan harga sedang menunggu master konten Strativate.',
  contentStatus: 'placeholder',
  cover: 'programs.bigClass.cover' as const,
}
