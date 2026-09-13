import type { AssetKey } from './asset-registry'
import { featureFlags } from '@/lib/features'

export type NavigationIcon = 'house' | 'compass' | 'users' | 'library' | 'sparkles' | 'help'

const marketingNavigationItems = [
  { label: 'Beranda', href: '/', icon: 'house' },
  { label: 'Program', href: '/program', icon: 'compass' },
  { label: 'Mentor', href: '/mentor', icon: 'users' },
  { label: 'Produk Digital', href: '/produk-digital', icon: 'library' },
  { label: 'Tentang Kami', href: '/tentang-kami', icon: 'sparkles' },
  { label: 'Tanya Jawab', href: '/tanya-jawab', icon: 'help' },
] as const satisfies ReadonlyArray<{ label: string; href: string; icon: NavigationIcon }>

export const marketingNavigation = marketingNavigationItems.filter(
  (item) => featureFlags.digitalProducts || item.href !== '/produk-digital',
)

export const preparationPrinciples = [
  { number: '01', title: 'Mulai dari kebutuhanmu', description: 'Pilih dukungan berdasarkan tahap persiapan dan fokus yang sedang kamu kerjakan.' },
  { number: '02', title: 'Susun langkah yang jelas', description: 'Ubah tantangan besar menjadi agenda belajar yang lebih mudah dijalankan.' },
  { number: '03', title: 'Perbaiki dengan terarah', description: 'Gunakan setiap sesi dan materi untuk meninjau, mencoba, lalu menyempurnakan.' },
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
    category: 'Program',
    question: 'Di mana saya bisa membandingkan program?',
    answer: 'Halaman Program merangkum pilihan yang tersedia dan mengarahkanmu ke informasi setiap program.',
  },
  {
    category: 'Mentor',
    question: 'Bagaimana memilih mentor?',
    answer: 'Gunakan pencarian dan filter pada halaman Mentor untuk melihat kategori, keahlian, dan pengalaman yang tercantum pada setiap profil.',
  },
  {
    category: 'Dukungan',
    question: 'Bagaimana menghubungi Strativate?',
    answer: 'Hubungi Strativate melalui WhatsApp di +62 851-8775-4671 atau email strativateid@gmail.com.',
  },
] as const

export const bigClassPlaceholder = {
  title: 'Big Class',
  kicker: 'Kelas terbuka',
  description: 'Kelas terbuka untuk mempelajari topik bisnis, akuntansi, riset, dan persiapan kompetisi bersama mentor Strativate.',
  contentStatus: 'overview',
  cover: 'programs.bigClass.cover' as const,
}
