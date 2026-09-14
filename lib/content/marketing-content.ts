import type { AssetKey } from './asset-registry'
import { publicContact } from './brand'

export type NavigationIcon = 'house' | 'compass' | 'users' | 'library' | 'sparkles' | 'help'

export const marketingNavigationItems = [
  { label: 'Beranda', href: '/', icon: 'house' },
  { label: 'Program', href: '/program', icon: 'compass' },
  { label: 'Mentor', href: '/mentor', icon: 'users' },
  { label: 'Produk Digital', href: '/produk-digital', icon: 'library' },
  { label: 'Tentang Kami', href: '/tentang-kami', icon: 'sparkles' },
  { label: 'Tanya Jawab', href: '/tanya-jawab', icon: 'help' },
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
  category: 'Program' | 'Mentor' | 'Akun' | 'Dukungan'
  question: string
  answer: string
  source: 'services' | 'mentor-directory' | 'auth' | 'public-contact'
}

export const faqPreview = [
  {
    category: 'Program',
    question: 'Di mana saya bisa membandingkan program?',
    answer: 'Halaman Program merangkum pilihan yang tersedia dan mengarahkanmu ke informasi setiap program.',
    source: 'services',
  },
  {
    category: 'Program',
    question: 'Layanan apa saja yang tersedia di Strativate?',
    answer: 'Halaman Program memuat Private Mentoring, Intensive Mentoring, Big Class, serta layanan pendukung untuk konsultasi, persiapan, dan komunitas.',
    source: 'services',
  },
  {
    category: 'Program',
    question: 'Program mana yang sudah memiliki halaman informasi?',
    answer: 'Private Mentoring dan Intensive Mentoring memiliki tautan ke halaman informasi program. Big Class saat ini ditampilkan sebagai gambaran layanan.',
    source: 'services',
  },
  {
    category: 'Mentor',
    question: 'Bagaimana memilih mentor?',
    answer: 'Gunakan pencarian dan filter pada halaman Mentor untuk melihat kategori, keahlian, dan pengalaman yang tercantum pada setiap profil.',
    source: 'mentor-directory',
  },
  {
    category: 'Mentor',
    question: 'Informasi apa yang tersedia pada profil mentor?',
    answer: 'Setiap profil menampilkan informasi yang tersedia tentang kategori, keahlian, pengalaman, dan tautan LinkedIn bila tercantum.',
    source: 'mentor-directory',
  },
  {
    category: 'Akun',
    question: 'Bagaimana cara mendaftar?',
    answer: 'Di halaman Masuk, pilih Daftar lalu masukkan email untuk menerima tautan verifikasi dan melengkapi profil.',
    source: 'auth',
  },
  {
    category: 'Akun',
    question: 'Bagaimana cara masuk ke akun?',
    answer: 'Kamu dapat masuk dengan email dan kata sandi, atau melanjutkan dengan Google dari halaman Masuk.',
    source: 'auth',
  },
  {
    category: 'Dukungan',
    question: 'Bagaimana menghubungi Strativate?',
    answer: `Hubungi Strativate melalui WhatsApp di ${publicContact.phone} atau email ${publicContact.email}.`,
    source: 'public-contact',
  },
  {
    category: 'Dukungan',
    question: 'Saya belum yakin memilih program. Apa yang bisa dilakukan?',
    answer: 'Sampaikan kebutuhanmu melalui WhatsApp agar tim Strativate dapat membantu mengarahkan percakapan tentang program yang sesuai.',
    source: 'public-contact',
  },
] as const satisfies ReadonlyArray<MarketingFaq>

export const bigClassPlaceholder = {
  title: 'Big Class',
  kicker: 'Kelas terbuka',
  description: 'Kelas terbuka untuk mempelajari topik bisnis, akuntansi, riset, dan persiapan kompetisi bersama mentor Strativate.',
  contentStatus: 'overview',
  cover: 'programs.bigClass.cover' as const,
}
